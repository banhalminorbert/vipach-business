/**
 * ============================================================
 *  VIPACH for Business — kapcsolati űrlap backend
 *  business.vipach.at  →  office@vipach.at
 * ============================================================
 *
 *  TELEPÍTÉS (kb. 3 perc):
 *  1. Nyisd meg: https://script.google.com → "Új projekt"
 *     (azzal a Google-fiókkal, amelyikből az e-mail menjen)
 *  2. Töröld a Code.gs tartalmát, és illeszd be ezt a teljes fájlt.
 *  3. Mentés (Ctrl+S), projektnév: "VIPACH Business Form"
 *  4. Deploy → New deployment → ⚙️ típus: "Web app"
 *       - Description:  VIPACH form v1
 *       - Execute as:   Me (a saját fiókod)
 *       - Who has access:  Anyone   ← FONTOS, különben a weboldal nem éri el
 *  5. Deploy → engedélyezd a hozzáférést (Authorize access)
 *  6. Másold ki a kapott "Web app URL"-t
 *     (https://script.google.com/macros/s/XXXX/exec)
 *     és illeszd be az index.html-ben a GAS_URL változóba.
 *
 *  MÓDOSÍTÁS UTÁN: Deploy → Manage deployments → ✏️ →
 *  Version: "New version" → Deploy. (Az URL változatlan marad.)
 *
 *  OPCIONÁLIS NAPLÓZÁS GOOGLE SHEETBE:
 *  Hozz létre egy üres Google Sheetet, másold ki az ID-jét az URL-ből
 *  (a /d/ és /edit közötti rész), és írd be lent a SHEET_ID-be.
 */

var CONFIG = {
  RECIPIENT: 'office@vipach.at',
  FALLBACK_SUBJECT: 'VIPACH for Business — Új ajánlatkérés / kapcsolatfelvétel',
  SEND_AUTO_REPLY: true,   // automatikus visszaigazolás az érdeklődőnek
  SHEET_ID: ''             // opcionális: Google Sheet ID a naplózáshoz, üresen kihagyja
};

// Az űrlap value → olvasható magyar címke megfeleltetések
var SERVICE_LABELS = {
  'digital-entity': 'Digitális entitásépítés',
  'ai-entity':      'AI entitás / vállalati DNS programozás',
  'executive':      'Executive portré / LinkedIn',
  'brand':          'Brand fotózás',
  'event':          'C-level eseményfotózás',
  'team':           'Céges csapatépítés',
  'web':            'Professzionális weboldal készítés',
  'webapp':         'Webes alkalmazás készítés',
  'education':      'AI-alapú weboldalkészítő oktatás',
  'consult':        'Még nem tudja, konzultációt kér'
};

var LOCATION_LABELS = {
  'hu':    'Magyarország',
  'at':    'Ausztria',
  'hu-at': 'Magyarország és Ausztria',
  'other': 'Egyéb ország',
  'prep':  'Még előkészítés alatt áll'
};

var TIMELINE_LABELS = {
  'now':      'Azonnal',
  '1m':       '1 hónapon belül',
  '3m':       '3 hónapon belül',
  'later':    'Később',
  'research': 'Még csak tájékozódik'
};

/** Fő belépési pont — a weboldal POST kérése ide érkezik. */
function doPost(e) {
  try {
    var p = (e && e.parameter) || {};
    var multi = (e && e.parameters) || {};

    // Honeypot: ha a rejtett mező ki van töltve, gép küldte — csendben elnyeljük
    if (p.website_hp) {
      return jsonResponse_({ ok: true });
    }

    // Minimális validáció: név, e-mail és GDPR elfogadás
    var name  = clean_(p.name);
    var email = clean_(p.email);
    if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return jsonResponse_({ ok: false, error: 'missing_or_invalid_fields' });
    }
    if (!p.gdpr) {
      return jsonResponse_({ ok: false, error: 'privacy_not_accepted' });
    }

    var data = {
      name:        name,
      company:     clean_(p.company),
      email:       email,
      phone:       clean_(p.phone),
      online:      clean_(p.online),
      location:    LOCATION_LABELS[p.location] || clean_(p.location),
      timeline:    TIMELINE_LABELS[p.timeline] || clean_(p.timeline),
      services:    (multi.service || []).map(function (v) {
                     return SERVICE_LABELS[v] || v;
                   }).join(', '),
      budget:      clean_(p.budget),
      description: clean_(p.description),
      gdpr:        p.gdpr ? 'Elfogadva' : 'NINCS elfogadva',
      gdprAcceptedAt: clean_(p.gdpr_accepted_at),
      gdprAcceptanceText: clean_(p.gdpr_acceptance_text),
      privacyVersion: clean_(p.privacy_version),
      formLanguage: clean_(p.form_language || inferLanguage_(p.privacy_version, p.page)),
      page:        clean_(p.page),
      userAgent:   clean_(p.userAgent),
      processingContext: clean_(p.processing_context),
      receivedAt:  Utilities.formatDate(new Date(), 'Europe/Vienna', 'yyyy.MM.dd. HH:mm:ss')
    };

    var subject = clean_(p._subject) || CONFIG.FALLBACK_SUBJECT;

    // 1) Értesítő e-mail az office@vipach.at címre
    MailApp.sendEmail({
      to:       CONFIG.RECIPIENT,
      replyTo:  data.email,
      subject:  subject + ' — ' + data.name + (data.company ? ' (' + data.company + ')' : ''),
      htmlBody: buildNotificationHtml_(data),
      body:     buildNotificationText_(data),
      name:     'VIPACH for Business'
    });

    // 2) Automatikus visszaigazolás az érdeklődőnek
    if (CONFIG.SEND_AUTO_REPLY) {
      try {
        MailApp.sendEmail({
          to:       data.email,
          replyTo:  CONFIG.RECIPIENT,
          subject:  buildAutoReplySubject_(data),
          htmlBody: buildAutoReplyHtml_(data),
          body:     buildAutoReplyText_(data),
          name:     'VIPACH for Business'
        });
      } catch (autoErr) {
        // a visszaigazolás hibája ne buktassa el a fő küldést
      }
    }

    // 3) Opcionális naplózás Google Sheetbe
    if (CONFIG.SHEET_ID) {
      try { logToSheet_(data); } catch (sheetErr) { /* nem kritikus */ }
    }

    return jsonResponse_({ ok: true });

  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

/** Egyszerű állapotellenőrzés böngészőből (GET). */
function doGet() {
  return jsonResponse_({ ok: true, service: 'VIPACH for Business form endpoint', status: 'running' });
}

/* ───────────────────────── Segédfüggvények ───────────────────────── */

function clean_(v) {
  return (v || '').toString().trim().substring(0, 5000);
}

function inferLanguage_(privacyVersion, page) {
  var raw = ((privacyVersion || '') + ' ' + (page || '')).toString().toLowerCase();
  if (raw.indexOf('/de-at/') !== -1 || raw.indexOf('-de') !== -1) return 'de';
  if (raw.indexOf('/en/') !== -1 || raw.indexOf('-en') !== -1) return 'en';
  return 'hu';
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function esc_(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function row_(label, value) {
  if (!value) return '';
  return '<tr>' +
    '<td style="padding:10px 16px;border-bottom:1px solid #E6EDF7;font-size:11px;' +
    'letter-spacing:0.14em;text-transform:uppercase;color:#94763E;white-space:nowrap;' +
    'vertical-align:top;font-family:Arial,sans-serif;">' + esc_(label) + '</td>' +
    '<td style="padding:10px 16px;border-bottom:1px solid #E6EDF7;font-size:14px;' +
    'color:#122A52;line-height:1.6;font-family:Arial,sans-serif;">' +
    esc_(value).replace(/\n/g, '<br>') + '</td></tr>';
}

function buildNotificationHtml_(d) {
  return '' +
  '<div style="background:#F2F6FC;padding:32px 16px;font-family:Arial,sans-serif;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" ' +
      'style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid #DDE5F0;' +
      'border-radius:12px;overflow:hidden;width:100%;">' +
      '<tr><td style="padding:28px 32px;border-bottom:2px solid #B8935A;">' +
        '<div style="font-size:20px;color:#122A52;letter-spacing:0.04em;">VIPACH ' +
        '<span style="color:#B8935A;">·</span> for Business</div>' +
        '<div style="font-size:12px;color:#5C6A85;margin-top:6px;">Új ajánlatkérés / kapcsolatfelvétel — business.vipach.at</div>' +
      '</td></tr>' +
      '<tr><td style="padding:8px 16px 24px;">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">' +
          row_('Név', d.name) +
          row_('Cégnév', d.company) +
          row_('E-mail', d.email) +
          row_('Telefon', d.phone) +
          row_('Online jelenlét', d.online) +
          row_('Működési hely', d.location) +
          row_('Időzítés', d.timeline) +
          row_('Érdeklődés', d.services) +
          row_('Keret', d.budget) +
          row_('Projektleírás', d.description) +
          row_('GDPR', d.gdpr) +
          row_('GDPR elfogadás ideje', d.gdprAcceptedAt) +
          row_('Elfogadott szöveg', d.gdprAcceptanceText) +
          row_('Adatvédelmi verzió', d.privacyVersion) +
          row_('Űrlap nyelve', d.formLanguage) +
          row_('Adatkezelési kontextus', d.processingContext) +
          row_('Beérkezett', d.receivedAt) +
          row_('Forrásoldal', d.page) +
        '</table>' +
      '</td></tr>' +
      '<tr><td style="padding:16px 32px;background:#F2F6FC;font-size:11px;color:#5C6A85;">' +
        'Válaszhoz használja a „Válasz” funkciót — a levél közvetlenül ' + esc_(d.email) + ' címre megy.' +
      '</td></tr>' +
    '</table>' +
  '</div>';
}

function buildNotificationText_(d) {
  var lines = [
    'VIPACH for Business — új ajánlatkérés / kapcsolatfelvétel', '',
    'Név: ' + d.name,
    'Cégnév: ' + d.company,
    'E-mail: ' + d.email,
    'Telefon: ' + d.phone,
    'Online jelenlét: ' + d.online,
    'Működési hely: ' + d.location,
    'Időzítés: ' + d.timeline,
    'Érdeklődés: ' + d.services,
    'Keret: ' + d.budget,
    'Projektleírás: ' + d.description,
    'GDPR: ' + d.gdpr,
    'GDPR elfogadás ideje: ' + d.gdprAcceptedAt,
    'Elfogadott szöveg: ' + d.gdprAcceptanceText,
    'Adatvédelmi verzió: ' + d.privacyVersion,
    'Űrlap nyelve: ' + d.formLanguage,
    'Adatkezelési kontextus: ' + d.processingContext,
    'Beérkezett: ' + d.receivedAt,
    'Forrásoldal: ' + d.page
  ];
  return lines.join('\n');
}

function buildAutoReplySubject_(d) {
  var lang = (d.formLanguage || 'hu').toLowerCase();
  if (lang === 'en') return 'Thank you for your request — VIPACH for Business';
  if (lang === 'de') return 'Vielen Dank für Ihre Anfrage — VIPACH for Business';
  return 'Köszönjük megkeresését — VIPACH for Business';
}

function buildAutoReplyText_(d) {
  var lang = (d.formLanguage || 'hu').toLowerCase();
  if (lang === 'en') {
    return 'Dear ' + d.name + ',\n\nThank you for your request. We have received your message and will contact you with the next step within 48 hours. Please also check your spam or promotions folder.\n\nBest regards,\nVIPACH for Business\noffice@vipach.at · business.vipach.at';
  }
  if (lang === 'de') {
    return 'Sehr geehrte/r ' + d.name + ',\n\nvielen Dank für Ihre Anfrage. Wir haben Ihre Nachricht erhalten und melden uns innerhalb von 48 Stunden mit dem nächsten Schritt. Bitte prüfen Sie auch Ihren Spam- oder Promotions-Ordner.\n\nMit freundlichen Grüßen\nVIPACH for Business\noffice@vipach.at · business.vipach.at';
  }
  return 'Kedves ' + d.name + '!\n\nKöszönjük megkeresését. Üzenetét megkaptuk, és ajánlattal 48 órán belül megkeressük. Kérjük, ellenőrizze a spam vagy promóciók mappát is.\n\nÜdvözlettel,\nVIPACH for Business\noffice@vipach.at · business.vipach.at';
}

function buildAutoReplyHtml_(d) {
  var lang = (d.formLanguage || 'hu').toLowerCase();
  var greeting = 'Kedves ' + esc_(d.name) + '!';
  var message = 'Köszönjük megkeresését. Üzenetét megkaptuk, és a megadott információk alapján <strong>ajánlattal 48 órán belül megkeressük</strong>. Kérjük, ellenőrizze a spam vagy promóciók mappát is.';
  var closing = 'Üdvözlettel,<br><strong>VIPACH for Business</strong>';
  if (lang === 'en') {
    greeting = 'Dear ' + esc_(d.name) + ',';
    message = 'Thank you for your request. We have received your message and will contact you with the next step <strong>within 48 hours</strong>. Please also check your spam or promotions folder.';
    closing = 'Best regards,<br><strong>VIPACH for Business</strong>';
  } else if (lang === 'de') {
    greeting = 'Sehr geehrte/r ' + esc_(d.name) + ',';
    message = 'Vielen Dank für Ihre Anfrage. Wir haben Ihre Nachricht erhalten und melden uns <strong>innerhalb von 48 Stunden</strong> mit dem nächsten Schritt. Bitte prüfen Sie auch Ihren Spam- oder Promotions-Ordner.';
    closing = 'Mit freundlichen Grüßen<br><strong>VIPACH for Business</strong>';
  }
  return '' +
  '<div style="background:#F2F6FC;padding:32px 16px;font-family:Arial,sans-serif;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" ' +
      'style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #DDE5F0;' +
      'border-radius:12px;overflow:hidden;width:100%;">' +
      '<tr><td style="padding:28px 32px;border-bottom:2px solid #B8935A;">' +
        '<div style="font-size:20px;color:#122A52;letter-spacing:0.04em;">VIPACH ' +
        '<span style="color:#B8935A;">·</span> for Business</div>' +
      '</td></tr>' +
      '<tr><td style="padding:28px 32px;font-size:14.5px;color:#122A52;line-height:1.7;">' +
        greeting + '<br><br>' + message + '<br><br>' + closing +
      '</td></tr>' +
      '<tr><td style="padding:16px 32px;background:#F2F6FC;font-size:12px;color:#5C6A85;">' +
        'office@vipach.at · <a href="https://business.vipach.at" style="color:#94763E;">business.vipach.at</a> · Wien' +
      '</td></tr>' +
    '</table>' +
  '</div>';
}

function logToSheet_(d) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName('Leads') || ss.insertSheet('Leads');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Beérkezett', 'Név', 'Cégnév', 'E-mail', 'Telefon', 'Online jelenlét',
                     'Működési hely', 'Időzítés', 'Érdeklődés', 'Keret', 'Projektleírás',
                     'GDPR', 'GDPR elfogadás ideje', 'Elfogadott szöveg', 'Adatvédelmi verzió', 'Űrlap nyelve', 'Forrásoldal']);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([d.receivedAt, d.name, d.company, d.email, d.phone, d.online,
                   d.location, d.timeline, d.services, d.budget, d.description,
                   d.gdpr, d.gdprAcceptedAt, d.gdprAcceptanceText, d.privacyVersion, d.formLanguage, d.page]);
}
