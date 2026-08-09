// Runtime configuration for the web client — resolves the API base per environment,
// so the same files work locally AND when hosted, with no build step.
//
// Resolution order:
//   1. ?api=<url> query param            (quick override for testing)
//   2. window.SAFEPAY_API_BASE           (inject at deploy time if you want)
//   3. localhost/127.0.0.1 during dev    -> http://localhost:4000/api
//   4. anything else (hosted)            -> same origin + /api
//      (works when the API is served from the same domain — the default here,
//       since the backend serves this web app and proxies /api.)
(function () {
  var params = new URLSearchParams(location.search);
  var host = location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
  var apiBase =
    params.get('api') ||
    window.SAFEPAY_API_BASE ||
    (isLocal ? 'http://localhost:4000/api' : location.origin + '/api');
  // Customer-care contact details. Edit these here — no rebuild needed.
  // WhatsApp must be in international format, digits only: 254 = Kenya, then the
  // number without its leading 0. So 0713 427338 -> 254713427338.
  var support = {
    whatsapp: '254713427338',
    whatsappLabel: '+254 713 427338',
    hours: 'Mon–Sat, 8am–8pm EAT',
  };

  window.APP_CONFIG = { API_BASE: apiBase, SUPPORT: support };
})();
