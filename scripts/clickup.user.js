// ==UserScript==
// @name         ClickUp Timesheet Comma to Period
// @namespace    https://kiona.clickup.com
// @version      1.1
// @description  Comma to period in time inputs, day total highlights, and arrow keys for week nav on timesheet
// @author       You
// @match        https://kiona.clickup.com/*/time*
// @match        https://*.clickup.com/*/time*
// @grant        none
// ==/UserScript==

(function () {
	const TARGET_DAILY_TOTAL = '7h 30m';
	const HIGHLIGHT_CLASS = 'cu-us-day-target-total';

	/**
	 * Add style used for highlighting matching day headers
	 */
	function injectHighlightStyles() {
		if (document.querySelector('#cu-us-target-total-style')) {
			return;
		}

		const style = document.createElement('style');
		style.id = 'cu-us-target-total-style';
		style.textContent = `
			.time-hub-task-table-header-cell.${HIGHLIGHT_CLASS},
			.time-hub-task-table-header-cell.${HIGHLIGHT_CLASS}:hover {
				background-color: #d7f5dc !important;
				border-radius: 8px;
			}

			.time-hub-task-table-header-cell.${HIGHLIGHT_CLASS} .time-hub-task-table-header-cell__title,
			.time-hub-task-table-header-cell.${HIGHLIGHT_CLASS} .time-hub-task-table-header-cell__total-time-tracked,
			.time-hub-task-table-header-cell.${HIGHLIGHT_CLASS}:hover .time-hub-task-table-header-cell__title,
			.time-hub-task-table-header-cell.${HIGHLIGHT_CLASS}:hover .time-hub-task-table-header-cell__total-time-tracked {
				color: #166534 !important;
			}
		`;

		document.head.append(style);
	}

	/**
	 * Highlight day header cells matching the target daily total
	 */
	function updateDayHeaderHighlights() {
		for (const total of document.querySelectorAll(
			'.time-hub-task-table-header-cell__total-time-tracked[data-test^="daily-summary-"]',
		)) {
			// Ignore the total column that uses no date
			if (total.dataset.test === 'daily-summary-no-date') {
				continue;
			}

			const totalText = total.textContent?.replaceAll(/\s+/g, ' ').trim() ?? '';
			const headerCell = total.closest('.time-hub-task-table-header-cell');
			if (!headerCell) {
				continue;
			}

			headerCell.classList.toggle(
				HIGHLIGHT_CLASS,
				totalText === TARGET_DAILY_TOTAL,
			);
		}
	}

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

		updateDayHeaderHighlights();
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

						if (
							node.matches?.(
								'.time-hub-task-table-header-cell, .time-hub-task-table-header-cell__total-time-tracked',
							) ||
							node.querySelector?.(
								'.time-hub-task-table-header-cell, .time-hub-task-table-header-cell__total-time-tracked',
							)
						) {
							updateDayHeaderHighlights();
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

	function isEditableTarget(element) {
		if (!element || element.nodeType !== Node.ELEMENT_NODE) {
			return false;
		}

		const tag = element.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
			return true;
		}

		if (element.isContentEditable) {
			return true;
		}

		return Boolean(element.closest('[contenteditable="true"]'));
	}

	/**
	 * Left/right arrow keys trigger the same week navigation as the toolbar chevrons
	 */
	function setupWeekArrowShortcuts() {
		document.addEventListener(
			'keydown',
			event => {
				if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
					return;
				}

				if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
					return;
				}

				if (isEditableTarget(event.target)) {
					return;
				}

				const label =
					event.key === 'ArrowLeft' ? 'Previous week' : 'Next week';
				const nav = document.querySelector('cu-time-hub-date-navigation');
				const button =
					nav?.querySelector(`button[aria-label="${label}"]`) ??
					document.querySelector(`button[aria-label="${label}"]`);

				if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				button.click();
			},
			true,
		);
	}

	// Initialize when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			injectHighlightStyles();
			processExistingInputs();
			observeDOM();
			setupGlobalHandler();
			setupWeekArrowShortcuts();
		});
	} else {
		injectHighlightStyles();
		processExistingInputs();
		observeDOM();
		setupGlobalHandler();
		setupWeekArrowShortcuts();
	}

	console.log('ClickUp Comma to Period script loaded');
})();
