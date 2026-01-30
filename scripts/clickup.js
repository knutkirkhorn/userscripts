// ==UserScript==
// @name         ClickUp Timesheet Comma to Period
// @namespace    https://kiona.clickup.com
// @version      1.0
// @description  Automatically replaces commas with periods in time input fields on ClickUp timesheet
// @author       You
// @match        https://kiona.clickup.com/*/time*
// @match        https://*.clickup.com/*/time*
// @grant        none
// ==/UserScript==

(function () {
	/**
	 * Replace comma with period in an input element
	 * @param {Event} event - The input event
	 */
	function replaceCommaWithPeriod(event) {
		const input = event.target;
		const cursorPosition = input.selectionStart;
		const originalValue = input.value;

		if (originalValue.includes(',')) {
			const newValue = originalValue.replaceAll(',', '.');
			input.value = newValue;

			// Restore cursor position
			input.setSelectionRange(cursorPosition, cursorPosition);

			// Dispatch input event to notify ClickUp of the change
			input.dispatchEvent(new Event('input', {bubbles: true}));
		}
	}

	/**
	 * Check if an element is a time input field
	 * @param {Element} element - The element to check
	 * @returns {boolean} - True if it's a time input field
	 */
	function isTimeInputField(element) {
		if (!element || element.tagName !== 'INPUT') {
			return false;
		}

		// Check for common time input attributes/classes
		const placeholder = (element.placeholder || '').toLowerCase();
		const className = (element.className || '').toLowerCase();

		return (
			placeholder.includes('h') ||
			placeholder.includes('time') ||
			className.includes('time') ||
			className.includes('duration') ||
			element.closest('[class*="time"]') !== null ||
			element.closest('[class*="duration"]') !== null ||
			element.closest('[class*="timesheet"]') !== null
		);
	}

	/**
	 * Attach listener to an input element
	 * @param {Element} input - The input element
	 */
	function attachListener(input) {
		if (input._commaListenerAttached) {
			return;
		}

		input.addEventListener('input', replaceCommaWithPeriod);
		input._commaListenerAttached = true;
	}

	/**
	 * Process all existing input fields
	 */
	function processExistingInputs() {
		for (const input of document.querySelectorAll('input')) {
			if (isTimeInputField(input)) {
				attachListener(input);
			}
		}
	}

	/**
	 * Use MutationObserver to watch for dynamically added input fields
	 */
	function observeDOM() {
		const observer = new MutationObserver(mutations => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (node.nodeType === Node.ELEMENT_NODE) {
						// Check if the added node is an input
						if (node.tagName === 'INPUT' && isTimeInputField(node)) {
							attachListener(node);
						}

						// Check for inputs within added nodes
						for (const input of node.querySelectorAll?.('input') ?? []) {
							if (isTimeInputField(input)) {
								attachListener(input);
							}
						}
					}
				}
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}
	/**
	 * Global input handler as fallback - catches all inputs on the page
	 */
	function setupGlobalHandler() {
		document.addEventListener(
			'input',
			event => {
				if (event.target.tagName === 'INPUT') {
					replaceCommaWithPeriod(event);
				}
			},
			true,
		);
	}

	// Initialize when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			processExistingInputs();
			observeDOM();
			setupGlobalHandler();
		});
	} else {
		processExistingInputs();
		observeDOM();
		setupGlobalHandler();
	}

	console.log('ClickUp Comma to Period script loaded');
})();
