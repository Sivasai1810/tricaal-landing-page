/**
 * Tricaal — website lead backend (Google Apps Script)
 *
 * For every lead from the website this script:
 *   1. Saves a row in the "Leads" tab of this Google Sheet   (the permanent record)
 *   2. Sends you an email alert                              (from your Google account; no extra credentials)
 *   3. Sends you a WhatsApp alert                            (Meta WhatsApp Cloud API or CallMeBot)
 * Alerts never block storage: the row is saved first, and the "Alerts" column records what was sent.
 *
 * ── SETUP ───────────────────────────────────────────────────────────────────────────────
 *  1. Create a Google Sheet → Extensions → Apps Script → paste this whole file → Save.
 *  2. Project Settings (gear icon, left) → Script Properties → add the properties below.
 *     Credentials live here, NOT in the website code, so visitors can never see them.
 *  3. Run the function `testAlerts` once from the editor (choose it in the toolbar → Run) and approve
 *     the permissions. You should receive a test email + WhatsApp message and see a test row.
 *  4. Deploy → New deployment → gear → "Web app" → Execute as: Me · Who has access: Anyone → Deploy.
 *  5. Copy the Web app URL (ends in /exec) into CONFIG.googleSheetUrl at the top of main.js.
 *  After editing this script later: Deploy → Manage deployments → edit → Version: New version → Deploy.
 *
 * ── SCRIPT PROPERTIES ───────────────────────────────────────────────────────────────────
 *  Email alert
 *    ALERT_EMAIL            Where alerts go. Optional: defaults to your Google account email.
 *                           Several addresses: separate with commas.
 *
 *  WhatsApp alert: pick ONE provider
 *    WHATSAPP_PROVIDER      "callmebot"  or  "meta"   (leave unset to skip WhatsApp)
 *
 *    Option A: CallMeBot (free, 2-minute setup, sends only to your own number; good for personal alerts)
 *      CALLMEBOT_PHONE      Your WhatsApp number with country code, digits only, e.g. 919876543210
 *      CALLMEBOT_APIKEY     The key CallMeBot sends you (see https://www.callmebot.com/blog/free-api-whatsapp-messages/)
 *
 *    Option B: Meta WhatsApp Cloud API (official, uses your WhatsApp Business number)
 *      META_WA_TOKEN            Permanent access token (System User token from Meta Business Settings)
 *      META_WA_PHONE_NUMBER_ID  "Phone number ID" from WhatsApp → API Setup in your Meta app
 *      META_WA_TO               Number that receives alerts, digits only, e.g. 919876543210
 *      META_WA_TEMPLATE         Name of an APPROVED template, e.g. new_lead_alert (see body below)
 *      META_WA_TEMPLATE_LANG    Template language code. Optional, default "en"
 *      Suggested template (category: Utility), with 4 variables:
 *        "New website lead: {{1}} ({{2}}). Industry: {{3}}. Top opportunity: {{4}}. Check your Leads sheet."
 */

const SHEET_NAME = 'Leads';
const HEADERS = [
  'Received', 'Name', 'Contact', 'Preferred channel', 'Industry',
  'Bottlenecks', 'Top opportunities', 'Completed in (s)', 'Page', 'Status', 'Alerts',
];

/* ───────────────────────────── Web endpoint ───────────────────────────── */

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // two leads arriving together must not write the same row
  let lead, rowIndex;
  try {
    lead = JSON.parse(e.postData.contents);
    // Hidden spam-trap field from the website: real visitors never tick it.
    if (lead && lead.botcheck) return json({ ok: true });
    if (!lead || typeof lead !== 'object' || !lead.name || !lead.contact) {
      return json({ ok: false, error: 'Missing name or contact' });
    }
    rowIndex = saveLead(lead);
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }

  // Lead is safely stored; now alert. Failures here are recorded but never lose the lead.
  const results = sendAlerts(lead);
  getSheet().getRange(rowIndex, HEADERS.indexOf('Alerts') + 1).setValue(results.join(' · '));
  return json({ ok: true });
}

// Open the web app URL in a browser to check it's live.
function doGet() {
  return json({ ok: true, message: 'Tricaal lead endpoint is running.' });
}

/* ───────────────────────────── Storage ───────────────────────────── */

function saveLead(lead) {
  const sheet = getSheet();
  sheet.appendRow([
    new Date(),
    clean(lead.name),
    clean(lead.contact),
    clean(lead.channel),
    clean(lead.industry),
    clean((lead.bottlenecks || []).join(', ')),
    clean((lead.opportunities || []).map((o, i) => (i + 1) + '. ' + o).join('\n')),
    Number(lead.secondsToComplete) || '',
    clean(lead.page),
    'New',
    'sending…',
  ]);
  return sheet.getLastRow();
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  const header = sheet.getLastRow() ? sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0] : [];
  if (header.join('|') !== HEADERS.join('|')) { // new sheet, or an older version without the Alerts column
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#eef2e8');
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('dd mmm yyyy, hh:mm');
  }
  return sheet;
}

// Trims long input and stops text like "=IMPORTXML(...)" or "+91..." being treated as a formula.
function clean(value) {
  const s = String(value == null ? '' : value).slice(0, 1000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/* ───────────────────────────── Alerts ───────────────────────────── */

function sendAlerts(lead) {
  const results = [];
  try { sendEmailAlert(lead); results.push('email ✓'); }
  catch (err) { results.push('email ✗ ' + String(err).slice(0, 120)); }

  const provider = (prop('WHATSAPP_PROVIDER') || '').toLowerCase();
  if (provider) {
    try {
      if (provider === 'callmebot') sendCallMeBot(lead);
      else if (provider === 'meta') sendMetaWhatsApp(lead);
      else throw new Error('Unknown WHATSAPP_PROVIDER "' + provider + '"');
      results.push('whatsapp ✓');
    } catch (err) {
      results.push('whatsapp ✗ ' + String(err).slice(0, 120));
    }
  }
  return results;
}

function sendEmailAlert(lead) {
  const to = prop('ALERT_EMAIL') || Session.getEffectiveUser().getEmail();
  const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  const rows = [
    ['Name', lead.name], ['Contact', lead.contact], ['Preferred channel', lead.channel],
    ['Industry', lead.industry], ['Bottlenecks', (lead.bottlenecks || []).join(', ')],
    ['Top opportunities', (lead.opportunities || []).map((o, i) => (i + 1) + '. ' + o).join('\n')],
    ['Completed in', (lead.secondsToComplete || '?') + 's'], ['Page', lead.page],
  ];
  const html =
    '<div style="font-family:Arial,sans-serif;color:#1c2a21">' +
    '<h2 style="margin:0 0 12px;color:#2f6b3f">New website lead</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse;font-size:14px">' +
    rows.map(([k, v]) => '<tr><td style="color:#56665b;vertical-align:top">' + k + '</td><td><b>' +
      escapeHtml(v).replace(/\n/g, '<br>') + '</b></td></tr>').join('') +
    '</table><p><a href="' + sheetUrl + '">Open the Leads sheet →</a></p></div>';

  const options = { name: 'Tricaal Website', htmlBody: html };
  if (lead.channel === 'email' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.contact)) options.replyTo = lead.contact;
  MailApp.sendEmail(to, 'New lead: ' + lead.name + ' (' + (lead.industry || 'unknown') + ')',
    rows.map(([k, v]) => k + ': ' + String(v).replace(/\n/g, ', ')).join('\n') + '\n\nSheet: ' + sheetUrl, options);
}

function sendCallMeBot(lead) {
  const phone = requireProp('CALLMEBOT_PHONE');
  const apikey = requireProp('CALLMEBOT_APIKEY');
  const text = '🔔 *New Tricaal lead*\n' +
    '*' + lead.name + '* · ' + lead.contact + '\n' +
    'Industry: ' + (lead.industry || '-') + '\n' +
    'Needs: ' + (lead.bottlenecks || []).join(', ') + '\n' +
    'Top pick: ' + ((lead.opportunities || [])[0] || '-');
  const url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(phone) +
    '&text=' + encodeURIComponent(text) + '&apikey=' + encodeURIComponent(apikey);
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const body = res.getContentText();
  if (res.getResponseCode() !== 200 || /error|invalid/i.test(body)) throw new Error('CallMeBot: ' + body.slice(0, 200));
}

function sendMetaWhatsApp(lead) {
  const token = requireProp('META_WA_TOKEN');
  const phoneId = requireProp('META_WA_PHONE_NUMBER_ID');
  const to = requireProp('META_WA_TO');
  const template = requireProp('META_WA_TEMPLATE');
  const param = (t) => ({ type: 'text', text: String(t || '-').replace(/\s+/g, ' ').slice(0, 300) });
  const res = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/' + phoneId + '/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: template,
        language: { code: prop('META_WA_TEMPLATE_LANG') || 'en' },
        components: [{
          type: 'body',
          parameters: [param(lead.name), param(lead.contact), param(lead.industry), param((lead.opportunities || [])[0])],
        }],
      },
    }),
  });
  if (res.getResponseCode() >= 300) throw new Error('Meta ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
}

/* ───────────────────────────── Helpers ───────────────────────────── */

// Run this once from the editor after adding Script Properties to check everything works.
function testAlerts() {
  const lead = {
    name: 'Test Lead', contact: 'test@example.com', channel: 'email', industry: 'Clinic / healthcare',
    bottlenecks: ['Booking & rescheduling'], opportunities: ['Automated patient appointments + reminders'],
    secondsToComplete: 9.9, page: 'testAlerts()',
  };
  const row = saveLead(lead);
  const results = sendAlerts(lead);
  getSheet().getRange(row, HEADERS.indexOf('Alerts') + 1).setValue(results.join(' · '));
  Logger.log(results.join('\n'));
}

function prop(key) { return PropertiesService.getScriptProperties().getProperty(key); }
function requireProp(key) {
  const v = prop(key);
  if (!v) throw new Error('Missing Script Property ' + key);
  return v.trim();
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
