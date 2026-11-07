// ==UserScript==
// @name         Google Consent Auto Reject
// @namespace    https://www.google.com/
// @version      1.0.0
// @description  Reject the "Before you continue to Google" cookie dialog without it ever showing
// @author       Knut Kirkhorn
// @match        https://www.google.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
	const CONSENT_DIALOG_SELECTOR =
		'[role="dialog"][aria-modal="true"]:has(a[href*="policies.google.com/technologies/cookies"])';
	const REJECT_BUTTON_SELECTOR = `${CONSENT_DIALOG_SELECTOR} #W0wltc`;

	// The dialog is part of the server rendered HTML, so it must be hidden before the body is parsed
	const style = document.createElement('style');
	style.textContent = `${CONSENT_DIALOG_SELECTOR} {display: none !important;}`;

	// Some userscript managers inject before the root element exists
	if (document.documentElement) {
		document.documentElement.append(style);
	} else {
		new MutationObserver((_, observer) => {
			if (!document.documentElement) return;
			observer.disconnect();
			document.documentElement.append(style);
		}).observe(document, {childList: true});
	}

	// Clicks made while the HTML is still parsing are ignored, as Google has not wired up the button yet
	function rejectConsent() {
		document.querySelector(REJECT_BUTTON_SELECTOR)?.click();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', rejectConsent);
	} else {
		rejectConsent();
	}
})();
