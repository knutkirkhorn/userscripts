/* global Bun */
import {runInNewContext} from 'node:vm';
import {expect, test} from 'bun:test';

const userscript = await Bun.file(
	new URL('../scripts/clickup.user.js', import.meta.url),
).text();

function loadWeekNumberFunctions(dailySummaryDates = []) {
	const testableUserscript = userscript.replace(
		/\}\)\(\);\s*$/,
		'return {getDisplayedWeekDate, getIsoWeekNumber};\n})();',
	);
	const document = {
		readyState: 'loading',
		addEventListener() {},
		querySelectorAll() {
			return dailySummaryDates.map(date => ({
				dataset: {test: `daily-summary-${date}`},
			}));
		},
	};
	const CurrentDate = class extends Date {
		constructor(...arguments_) {
			super(...(arguments_.length > 0 ? arguments_ : ['2026-09-21T12:00:00Z']));
		}
	};

	return runInNewContext(testableUserscript, {
		console,
		Date: CurrentDate,
		document,
	});
}

test('uses the visible range when the previous week remains in the DOM', () => {
	const {getDisplayedWeekDate, getIsoWeekNumber} = loadWeekNumberFunctions([
		'2026-09-21',
	]);
	const displayedDate = getDisplayedWeekDate({
		textContent: 'Sep 28 - Oct 4 (week 39)',
	});

	expect(displayedDate.toISOString()).toBe('2026-09-28T00:00:00.000Z');
	expect(getIsoWeekNumber(displayedDate)).toBe(40);
});
