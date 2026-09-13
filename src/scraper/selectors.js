/**
 * Every CSS selector for the ECCP portal lives here, confirmed against the
 * real page markup shared during the architecture discussion. Flow logic
 * should always read from this file, never inline a selector.
 */
module.exports = {
  login: {
    form: '#form-login',
    ccpInput: '#ccp',
    passwordInput: '#password',
    submitButton: '#form-login button[type="submit"]',
    toastError: '.toast-error',
    // Only present in the post-login nav — proof the session actually took
    loggedInMarker: 'a.user-action',
  },

  nav: {
    releveDropdownToggle: 'li.dropdown.effect > a.dropdown-toggle',
    releveLink: 'li.dropdown.effect ul.dropdown-menu a[href="/relevé-de-compte"]',
  },

  releveFilter: {
    start: {
      day: 'select[name="start_day"]',
      month: 'select[name="start_month"]',
      year: 'select[name="start_year"]',
    },
    end: {
      day: '#end_day',
      month: '#end_month',
      year: '#end_year',
    },
    submitButton: '.well form button[type="submit"]',
  },

  releveResults: {
    summaryBlock: '.well',
    table: '#results',
    tableRowSelector: '#results tbody tr',
    // Not observed in the sample we have — the sample had no empty range to
    // confirm this against. Verify live before relying on it.
    noResultsMarker: null,
    // No pager markup appeared in the sample (a ~3 month range rendered as
    // one unbroken table). May genuinely not exist — verify with a wider
    // range before assuming it's safe to skip pagination handling.
    pagination: {
      nextPageButton: null,
    },
  },
};
