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

/** True when the project's 2FA parent switch is on. @param {object} project project row @returns {boolean} */
function twoFaEnabled(project) {
    return Number((project || {}).module_auth_email_2fa) === 1;
}

/** True when the project's captcha parent switch is on. @param {object} project project row @returns {boolean} */
function captchaEnabled(project) {
    return Number((project || {}).module_auth_email_captcha) === 1;
}

// Normalise a stored mode value; unknown/empty -> 'basic'.
/** @param {object} project @returns {'basic'|'totp'|null} normalized 2FA mode, null when disabled */
function twoFaMode(project) {
    if (!twoFaEnabled(project)) return null;
    const m = String((project || {}).auth_2fa_mode || 'basic').toLowerCase();
    return TOTP_MODES.includes(m) ? m : 'basic';
}

/** @param {object} project @returns {'basic'|'recaptcha_v2'|null} normalized captcha mode, null when disabled */
function captchaMode(project) {
    if (!captchaEnabled(project)) return null;
    const m = String((project || {}).auth_captcha_mode || 'basic').toLowerCase();
    return CAPTCHA_MODES.includes(m) ? m : 'basic';
}

/** True when 2FA is set to TOTP (Google Authenticator). @param {object} project @returns {boolean} */
function isTotp(project) {
    return twoFaMode(project) === 'totp';
}

/** True when captcha is set to Google reCAPTCHA v2. @param {object} project @returns {boolean} */
function isRecaptcha(project) {
    return captchaMode(project) === 'recaptcha_v2';
}

module.exports = { twoFaEnabled, captchaEnabled, twoFaMode, captchaMode, isTotp, isRecaptcha };
