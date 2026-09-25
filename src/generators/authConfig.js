// Auth advanced-option config helper (2FA + Captcha).
//
// Two feature flags already existed:
//   module_auth_email_2fa      INTEGER  0/1  (parent switch)
//   module_auth_email_captcha  INTEGER  0/1  (parent switch)
//
// New mode columns select WHICH implementation is generated:
//   auth_2fa_mode      TEXT  'basic'  -> Filament native Email MFA (one-time code by email)
//                          'totp'    -> Google Authenticator (TOTP, Filament App MFA provider)
//   auth_captcha_mode  TEXT  'basic'  -> built-in arithmetic human check
//                          'recaptcha_v2' -> Google reCAPTCHA v2 checkbox
//
// Anything invalid falls back to 'basic' so old projects (mode column NULL)
// keep their previous behaviour.

'use strict';

const TOTP_MODES = ['basic', 'totp'];
const CAPTCHA_MODES = ['basic', 'recaptcha_v2'];

function twoFaEnabled(project) {
    return Number((project || {}).module_auth_email_2fa) === 1;
}

function captchaEnabled(project) {
    return Number((project || {}).module_auth_email_captcha) === 1;
}

// Normalise a stored mode value; unknown/empty -> 'basic'.
function twoFaMode(project) {
    if (!twoFaEnabled(project)) return null;
    const m = String((project || {}).auth_2fa_mode || 'basic').toLowerCase();
    return TOTP_MODES.includes(m) ? m : 'basic';
}

function captchaMode(project) {
    if (!captchaEnabled(project)) return null;
    const m = String((project || {}).auth_captcha_mode || 'basic').toLowerCase();
    return CAPTCHA_MODES.includes(m) ? m : 'basic';
}

function isTotp(project) {
    return twoFaMode(project) === 'totp';
}

function isRecaptcha(project) {
    return captchaMode(project) === 'recaptcha_v2';
}

module.exports = { twoFaEnabled, captchaEnabled, twoFaMode, captchaMode, isTotp, isRecaptcha };
