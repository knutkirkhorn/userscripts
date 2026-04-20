// ==UserScript==
// @name         ClickUp Timesheet Comma to Period
// @namespace    https://kiona.clickup.com
// @version      1.3
// @description  Comma to period in time inputs, day total highlights, arrow keys for week nav, and right-click task menu on timesheet
// @author       You
// @match        https://kiona.clickup.com/*/time*
// @match        https://*.clickup.com/*/time*
// @grant        none
// ==/UserScript==

(function () {
	const TARGET_DAILY_TOTAL = '7h 30m';
	const HIGHLIGHT_CLASS = 'cu-us-day-target-total';
	const TIME_TABLE_SELECTOR = '.time-hub-task-table';
	const TASK_ROW_SELECTOR = 'tr[data-task-id]';
	const CONTEXT_MENU_ID = 'cu-us-task-context-menu';
	const CONTEXT_MENU_STYLE_ID = 'cu-us-task-context-menu-style';

	let highlightRafId = 0;

	function nodeInTimeTable(node) {
		if (!node) {
			return false;
		}

		const element =
			node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
		return Boolean(element?.closest?.(TIME_TABLE_SELECTOR));
	}

	function mutationMayAffectDayTotals(mutation) {
		if (mutation.type === 'characterData' || mutation.type === 'childList') {
			return nodeInTimeTable(mutation.target);
		}

		return false;
	}

	function scheduleDayHeaderHighlights() {
		if (highlightRafId) {
			return;
		}

		highlightRafId = requestAnimationFrame(() => {
			highlightRafId = 0;
			updateDayHeaderHighlights();
		});
	}

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
				if (mutationMayAffectDayTotals(mutation)) {
					scheduleDayHeaderHighlights();
				}

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
			characterData: true,
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
					if (isTimeInputField(event.target)) {
						scheduleDayHeaderHighlights();
					}
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

				if (
					event.defaultPrevented ||
					event.altKey ||
					event.ctrlKey ||
					event.metaKey
				) {
					return;
				}

				if (isEditableTarget(event.target)) {
					return;
				}

				const label = event.key === 'ArrowLeft' ? 'Previous week' : 'Next week';
				const nav = document.querySelector('cu-time-hub-date-navigation');
				const button =
					nav?.querySelector(`button[aria-label="${label}"]`) ??
					document.querySelector(`button[aria-label="${label}"]`);

				if (
					!button ||
					button.disabled ||
					button.getAttribute('aria-disabled') === 'true'
				) {
					return;
				}

				event.preventDefault();
				event.stopPropagation();
				button.click();
			},
			true,
		);
	}

	function injectContextMenuStyles() {
		if (document.querySelector(`#${CONTEXT_MENU_STYLE_ID}`)) {
			return;
		}

		const style = document.createElement('style');
		style.id = CONTEXT_MENU_STYLE_ID;
		style.textContent = `
			#${CONTEXT_MENU_ID} {
				position: fixed;
				z-index: 2147483647;
				min-width: 180px;
				padding: 4px;
				background-color: #ffffff;
				border: 1px solid rgba(0, 0, 0, 0.08);
				border-radius: 8px;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
				font-size: 13px;
				color: #2b2b2b;
				user-select: none;
			}

			#${CONTEXT_MENU_ID} button {
				display: block;
				width: 100%;
				padding: 8px 12px;
				background: transparent;
				border: none;
				border-radius: 6px;
				text-align: left;
				font: inherit;
				color: inherit;
				cursor: pointer;
			}

			#${CONTEXT_MENU_ID} button:hover,
			#${CONTEXT_MENU_ID} button:focus {
				background-color: #f1f4f7;
				outline: none;
			}

			#${CONTEXT_MENU_ID} button[disabled] {
				color: #9aa2ad;
				cursor: not-allowed;
			}
		`;

		document.head.append(style);
	}

	function removeContextMenu() {
		const existing = document.querySelector(`#${CONTEXT_MENU_ID}`);
		if (existing) {
			existing.remove();
		}
	}

	/**
	 * Find the task row that was right-clicked. Task rows in the ClickUp
	 * timesheet are `<tr data-task-id="...">` elements inside the time table.
	 * @param {EventTarget | null} target
	 * @returns {HTMLElement | null}
	 */
	function findTaskRow(target) {
		if (!(target instanceof Element)) {
			// eslint-disable-next-line unicorn/no-null
			return null;
		}

		const row = target.closest(TASK_ROW_SELECTOR);
		if (row instanceof HTMLElement && row.closest(TIME_TABLE_SELECTOR)) {
			return row;
		}

		// eslint-disable-next-line unicorn/no-null
		return null;
	}

	/**
	 * Extract the task id from a task row using its `data-task-id` attribute.
	 * @param {HTMLElement | null | undefined} row
	 * @returns {string}
	 */
	function getTaskIdFromRow(row) {
		return row?.dataset?.taskId ?? '';
	}

	async function copyTextToClipboard(text) {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				return true;
			}
		} catch {
			// Fall through to legacy fallback
		}

		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.setAttribute('readonly', '');
		textarea.style.position = 'fixed';
		textarea.style.top = '-1000px';
		textarea.style.opacity = '0';
		document.body.append(textarea);
		textarea.select();

		let success = false;
		try {
			success = document.execCommand('copy');
		} catch {
			success = false;
		}

		textarea.remove();
		return success;
	}

	/**
	 * Show a custom context menu anchored at the given client coordinates
	 * @param {number} clientX
	 * @param {number} clientY
	 * @param {{label: string, onSelect: () => void, disabled?: boolean}[]} items
	 */
	function showContextMenu(clientX, clientY, items) {
		removeContextMenu();

		const menu = document.createElement('div');
		menu.id = CONTEXT_MENU_ID;
		menu.setAttribute('role', 'menu');

		for (const item of items) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = item.label;
			button.setAttribute('role', 'menuitem');
			if (item.disabled) {
				button.disabled = true;
			} else {
				button.addEventListener('click', () => {
					removeContextMenu();
					item.onSelect();
				});
			}

			menu.append(button);
		}

		// Position off-screen first so we can measure, then clamp to viewport
		menu.style.left = '0px';
		menu.style.top = '0px';
		menu.style.visibility = 'hidden';
		document.body.append(menu);

		const {offsetWidth: width, offsetHeight: height} = menu;
		const maxX = window.innerWidth - width - 4;
		const maxY = window.innerHeight - height - 4;
		menu.style.left = `${Math.max(4, Math.min(clientX, maxX))}px`;
		menu.style.top = `${Math.max(4, Math.min(clientY, maxY))}px`;
		menu.style.visibility = 'visible';
	}

	function setupTaskRowContextMenu() {
		document.addEventListener(
			'contextmenu',
			event => {
				const row = findTaskRow(event.target);
				if (!row) {
					return;
				}

				const taskId = getTaskIdFromRow(row);

				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();

				showContextMenu(event.clientX, event.clientY, [
					{
						label: taskId ? `Copy task ID (${taskId})` : 'Copy task ID',
						disabled: !taskId,
						onSelect: () => {
							if (taskId) {
								copyTextToClipboard(taskId);
							}
						},
					},
				]);
			},
			true,
		);

		const dismiss = event => {
			const menu = document.querySelector(`#${CONTEXT_MENU_ID}`);
			if (!menu) {
				return;
			}

			if (event.type === 'keydown' && event.key !== 'Escape') {
				return;
			}

			if (event.type === 'mousedown' && menu.contains(event.target)) {
				return;
			}

			removeContextMenu();
		};

		document.addEventListener('mousedown', dismiss, true);
		document.addEventListener('keydown', dismiss, true);
		document.addEventListener('scroll', removeContextMenu, true);
		window.addEventListener('blur', removeContextMenu);
		window.addEventListener('resize', removeContextMenu);
	}

	// Initialize when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => {
			injectHighlightStyles();
			injectContextMenuStyles();
			processExistingInputs();
			observeDOM();
			setupGlobalHandler();
			setupWeekArrowShortcuts();
			setupTaskRowContextMenu();
		});
	} else {
		injectHighlightStyles();
		injectContextMenuStyles();
		processExistingInputs();
		observeDOM();
		setupGlobalHandler();
		setupWeekArrowShortcuts();
		setupTaskRowContextMenu();
	}

	console.log('ClickUp Timesheet userscript loaded (v1.3)');
})();
