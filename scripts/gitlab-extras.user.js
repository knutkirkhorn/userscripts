// ==UserScript==
// @name     Extra shortcuts and improvements for GitLab
// @version  1
// @grant    none
// @match https://gitlab.com/*
// ==/UserScript==

// Add SAML session expiration detection.
// Refresh the page if the SAML modal is shown.
const observer = new MutationObserver(() => {
	// Finds the div that is not the outer modal div (does not contains id "___BV_modal_outer_")
	const samlModal = document.querySelector(
		"[id^='reload-saml-modal']:not([id$='___BV_modal_outer_'])",
	);
	console.log('debug: samlModal', samlModal);

	if (samlModal) {
		console.log(
			'debug: if check:',
			samlModal &&
				samlModal.getAttribute('aria-label') ===
					'Your SAML session has expired' &&
				samlModal.classList.contains('show'),
		);
		console.log(
			"debug: samlModal.getAttribute('aria-label')",
			samlModal.getAttribute('aria-label'),
		);
		console.log(
			"debug: samlModal.classList.contains('show')",
			samlModal.classList.contains('show'),
		);
	}

	if (
		samlModal &&
		samlModal.getAttribute('aria-label') === 'Your SAML session has expired' &&
		samlModal.classList.contains('show')
	) {
		console.log('SAML session expired, refreshing page');
		globalThis.location.reload();
	}
});

// Start observing the document body for changes
observer.observe(document.body, {
	childList: true,
	subtree: true,
});

// Add auto-search on Enter key press
function setupSearchOnEnterPressed() {
	// Check if we're on merge requests or issues page
	const isMergeRequestsPage =
		globalThis.location.pathname.includes('/-/merge_requests');
	const isIssuesPage = globalThis.location.pathname.includes('/-/issues');

	if (!isMergeRequestsPage && !isIssuesPage) return;

	const searchInput = document.querySelector(
		'input[data-testid="filtered-search-term-input"]',
	);
	if (!searchInput) return;

	searchInput.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault();
			// Find and click the search button
			const searchButton = document.querySelector(
				'button[data-testid="search-button"]',
			);
			if (searchButton) {
				searchButton.click();
			}
		}
	});
}

// Create an observer for the search input
const searchObserver = new MutationObserver(() => {
	setupSearchOnEnterPressed();
});

// Start observing for search input
searchObserver.observe(document.body, {
	childList: true,
	subtree: true,
});

// Initial setup (if already on this URL)
setupSearchOnEnterPressed();

// Add styles for MR/PR status and loader
const style = document.createElement('style');
style.textContent = `
	.mr-draft {
		background-color: #f8f0e3 !important;
		border-left: 4px solid #f0a500 !important;
	}
	.mr-ready {
		background-color: #e3fcef !important;
		border-left: 4px solid #108548 !important;
	}
	.gitlab-extras-loader-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 999999;
	}
	.gitlab-extras-loader-text {
		background-color: white;
		padding: 20px 40px;
		border-radius: 8px;
		font-size: 18px;
		font-weight: bold;
		color: #333;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}
	.gitlab-extras-mr-branch {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-left: 4px;
		color: var(--gray-700, #535158);
		white-space: nowrap;
	}
	.gitlab-extras-mr-branch-name {
		display: inline-block;
		max-width: 260px;
		overflow: hidden;
		padding: 0 6px;
		border: 1px solid var(--blue-200, #9dc7f1);
		border-radius: 4px;
		background-color: var(--blue-50, #eef6fc);
		color: var(--blue-900, #0b5cad);
		font-family: var(--default-monospace-font, monospace);
		font-size: 12px;
		line-height: 19px;
		text-overflow: ellipsis;
		vertical-align: middle;
	}
	.gitlab-extras-copy-branch {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: 1px solid transparent;
		border-radius: 4px;
		background: transparent;
		color: var(--gray-600, #626168);
		cursor: pointer;
		padding: 0;
		vertical-align: middle;
	}
	.gitlab-extras-copy-branch svg {
		display: block;
	}
	.gitlab-extras-copy-branch:hover {
		border-color: var(--gray-200, #dcdcde);
		background-color: var(--gray-100, #ececef);
	}
	.gitlab-extras-copy-branch-copied {
		color: var(--green-600, #108548);
		background-color: var(--green-50, #ecf4ee);
	}
	.gitlab-extras-stage-search-empty[hidden] {
		display: none;
	}
	.gitlab-extras-stage-search-empty {
		padding: 8px 16px;
		color: var(--gray-500, #737278);
		font-size: 14px;
	}
	.gitlab-extras-commit-type {
		display: inline-block;
		margin-right: 6px;
		padding: 0 7px;
		border: 1px solid
			color-mix(in srgb, var(--gitlab-extras-commit-type-color) 45%, transparent);
		border-radius: 999px;
		background-color: color-mix(
			in srgb,
			var(--gitlab-extras-commit-type-color) 15%,
			transparent
		);
		color: color-mix(in srgb, var(--gitlab-extras-commit-type-color) 70%, black);
		font-size: 12px;
		font-weight: 500;
		line-height: 18px;
		vertical-align: 1px;
		white-space: nowrap;
	}
	html.gl-dark .gitlab-extras-commit-type {
		color: color-mix(in srgb, var(--gitlab-extras-commit-type-color) 75%, white);
	}
	.gitlab-extras-commit-scope {
		color: var(--gl-text-color-subtle, #737278);
	}
`;
document.head.append(style);

// Loader helper functions
function showLoader(message = 'Loading...') {
	const overlay = document.createElement('div');
	overlay.className = 'gitlab-extras-loader-overlay';
	overlay.id = 'gitlab-extras-loader';
	const text = document.createElement('div');
	text.className = 'gitlab-extras-loader-text';
	text.textContent = message;
	overlay.append(text);
	document.body.append(overlay);
}

function hideLoader() {
	const overlay = document.querySelector('#gitlab-extras-loader');
	if (overlay) {
		overlay.remove();
	}
}

// Function to update MR/PR styling
function updateMRStyling() {
	const mrRows = document.querySelectorAll('.merge-request');

	for (const row of mrRows) {
		// Remove existing custom classes
		row.classList.remove('mr-draft', 'mr-ready');

		// Check if MR is draft
		const isDraft = row
			.querySelector('.issue-title-text')
			.textContent.trim()
			.startsWith('Draft: ');

		// Add class to MR row
		if (isDraft) {
			row.classList.add('mr-draft');
		} else {
			row.classList.add('mr-ready');
		}
	}
}

const branchNamesByIid = new Map();
const pendingBranchIids = new Set();
let branchFetchTimeout;

function getProjectPathFromUrl() {
	const pathParts = globalThis.location.pathname.split('/-/');
	return pathParts[0].slice(1);
}

function getMergeRequestIid(row) {
	const mergeRequestLink = row.querySelector('a[href*="/-/merge_requests/"]');
	const match = mergeRequestLink?.href.match(/\/-\/merge_requests\/(\d+)/);
	return match?.[1];
}

function createSvgElement(name, attributes) {
	const element = document.createElementNS('http://www.w3.org/2000/svg', name);

	for (const [attribute, value] of Object.entries(attributes)) {
		element.setAttribute(attribute, value);
	}

	return element;
}

function createCopyIcon() {
	const svg = createSvgElement('svg', {
		'aria-hidden': 'true',
		fill: 'currentColor',
		height: '14',
		viewBox: '0 0 16 16',
		width: '14',
	});
	const backPath = createSvgElement('path', {
		d: 'M0 6.75C0 5.78.78 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .14.11.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z',
	});
	const frontPath = createSvgElement('path', {
		d: 'M5 1.75C5 .78 5.78 0 6.75 0h7.5C15.22 0 16 .78 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .14.11.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z',
	});

	svg.append(backPath, frontPath);
	return svg;
}

function createCopiedIcon() {
	const svg = createSvgElement('svg', {
		'aria-hidden': 'true',
		fill: 'currentColor',
		height: '14',
		viewBox: '0 0 16 16',
		width: '14',
	});
	const path = createSvgElement('path', {
		d: 'M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z',
	});

	svg.append(path);
	return svg;
}

function createBranchElement(branchName) {
	const wrapper = document.createElement('span');
	wrapper.className = 'gitlab-extras-mr-branch';

	const branchText = document.createElement('span');
	branchText.className = 'gitlab-extras-mr-branch-name';
	branchText.textContent = branchName;

	const copyButton = document.createElement('button');
	copyButton.className = 'gitlab-extras-copy-branch';
	copyButton.type = 'button';
	copyButton.title = `Copy branch name: ${branchName}`;
	copyButton.setAttribute('aria-label', `Copy branch name ${branchName}`);
	copyButton.append(createCopyIcon());
	copyButton.addEventListener('click', async event => {
		event.preventDefault();
		event.stopPropagation();

		await navigator.clipboard.writeText(branchName);
		copyButton.classList.add('gitlab-extras-copy-branch-copied');
		copyButton.title = `Copied branch name: ${branchName}`;
		copyButton.setAttribute('aria-label', `Copied branch name ${branchName}`);
		copyButton.replaceChildren(createCopiedIcon());
		setTimeout(() => {
			copyButton.classList.remove('gitlab-extras-copy-branch-copied');
			copyButton.title = `Copy branch name: ${branchName}`;
			copyButton.setAttribute('aria-label', `Copy branch name ${branchName}`);
			copyButton.replaceChildren(createCopyIcon());
		}, 1500);
	});

	wrapper.append('· ', branchText, copyButton);
	return wrapper;
}

function addBranchElementToRow(row, branchName) {
	if (row.querySelector('.gitlab-extras-mr-branch')) return;

	const titleElement = row.querySelector('.issue-title-text');
	const infoLines = [...row.querySelectorAll('.issuable-info')];
	const metadataLine =
		infoLines.find(infoLine => !infoLine.contains(titleElement)) ??
		titleElement?.closest('.issuable-info');

	if (!metadataLine) return;

	const branchElement = createBranchElement(branchName);
	const authorLink = metadataLine.querySelector(
		'a.author-link, a[data-testid="author-link"]',
	);

	if (authorLink) {
		authorLink.after(' ', branchElement);
		return;
	}

	metadataLine.append(' ', branchElement);
}

function renderMergeRequestBranches() {
	const mergeRequestRows = document.querySelectorAll('.merge-request');

	for (const row of mergeRequestRows) {
		const mergeRequestIid = getMergeRequestIid(row);
		if (!mergeRequestIid) continue;

		const branchName = branchNamesByIid.get(mergeRequestIid);
		if (branchName) {
			addBranchElementToRow(row, branchName);
			continue;
		}

		pendingBranchIids.add(mergeRequestIid);
	}
}

async function fetchPendingBranchNames() {
	if (pendingBranchIids.size === 0) return;

	const iids = [...pendingBranchIids];
	pendingBranchIids.clear();

	const token = document
		.querySelector('meta[name="csrf-token"]')
		?.getAttribute('content');

	const response = await fetch('https://gitlab.com/api/graphql', {
		headers: {
			'Content-Type': 'application/json',
			...(token ? {'X-CSRF-Token': token} : {}),
		},
		body: JSON.stringify({
			operationName: 'getMergeRequestBranches',
			variables: {
				projectPath: getProjectPathFromUrl(),
				iids,
			},
			query:
				'query getMergeRequestBranches($projectPath: ID!, $iids: [String!]) { project(fullPath: $projectPath) { mergeRequests(iids: $iids) { nodes { iid sourceBranch } } } }',
		}),
		method: 'POST',
		mode: 'cors',
	});

	const data = await response.json();
	const mergeRequests = data.data?.project?.mergeRequests?.nodes ?? [];

	for (const mergeRequest of mergeRequests) {
		branchNamesByIid.set(mergeRequest.iid, mergeRequest.sourceBranch);
	}

	renderMergeRequestBranches();
}

function scheduleBranchNameFetch() {
	clearTimeout(branchFetchTimeout);
	branchFetchTimeout = setTimeout(() => {
		fetchPendingBranchNames().catch(error => {
			console.error('Error fetching branch names:', error);
		});
	}, 100);
}

function updateMergeRequestList() {
	updateMRStyling();
	renderMergeRequestBranches();
	scheduleBranchNameFetch();
}

function isOnMergeRequestsPage() {
	return (
		globalThis.location.pathname.endsWith('/-/merge_requests/') ||
		globalThis.location.pathname.endsWith('/-/merge_requests')
	);
}

// Create an observer for the MR list
const mrObserver = new MutationObserver(() => {
	if (isOnMergeRequestsPage()) {
		updateMergeRequestList();
	}
});

// Start observing the MR list
mrObserver.observe(document.body, {
	childList: true,
	subtree: true,
});

// Initial styling
if (isOnMergeRequestsPage()) {
	updateMergeRequestList();
}

// Always show a search input in pipeline stage dropdowns.
// GitLab only shows its own search when a stage has more than 12 jobs
const stageDropdownSelector = '[data-testid="pipeline-mini-graph-dropdown"]';
const stageSearchClass = 'gitlab-extras-stage-search';

function createSearchIcon() {
	const svg = createSvgElement('svg', {
		'aria-hidden': 'true',
		class: 'gl-search-box-by-type-search-icon gl-icon s16',
		fill: 'currentColor',
		height: '16',
		viewBox: '0 0 16 16',
		width: '16',
	});
	const path = createSvgElement('path', {
		d: 'M10.68 11.74a6 6 0 1 1 1.06-1.06l3.04 3.04a.75.75 0 1 1-1.06 1.06l-3.04-3.04ZM11.5 7a4.5 4.5 0 1 0-9 0 4.5 4.5 0 0 0 9 0Z',
	});

	svg.append(path);
	return svg;
}

function filterStageJobs(dropdown, query) {
	const jobList = dropdown.querySelector(
		'[data-testid="pipeline-mini-graph-dropdown-menu-list"]',
	);
	if (!jobList) return;

	const normalizedQuery = query.trim().toLowerCase();
	const jobItems = [...jobList.querySelectorAll('[data-testid="ci-job-item"]')];

	for (const jobItem of jobItems) {
		const jobName =
			jobItem.querySelector('[data-testid="job-name"]')?.textContent ??
			jobItem.textContent;
		const isMatch = jobName.toLowerCase().includes(normalizedQuery);
		jobItem.style.display = isMatch ? '' : 'none';
	}

	// Hide group headers like "Failed jobs" when none of their jobs match
	for (const group of jobList.querySelectorAll(
		'[data-testid="failed-jobs"], [data-testid="passed-jobs"]',
	)) {
		const hasVisibleJobs = [
			...group.querySelectorAll('[data-testid="ci-job-item"]'),
		].some(jobItem => jobItem.style.display !== 'none');
		group.style.display = hasVisibleJobs ? '' : 'none';
	}

	const emptyMessage = dropdown.querySelector(
		'.gitlab-extras-stage-search-empty',
	);
	if (emptyMessage) {
		const hasVisibleJobs = jobItems.some(
			jobItem => jobItem.style.display !== 'none',
		);
		emptyMessage.hidden = hasVisibleJobs || jobItems.length === 0;
	}
}

function createStageSearch(dropdown) {
	const container = document.createElement('div');
	container.className = stageSearchClass;

	const wrapper = document.createElement('div');
	wrapper.className = 'gl-search-box-by-type';

	const emptyMessage = document.createElement('div');
	emptyMessage.className = 'gitlab-extras-stage-search-empty';
	emptyMessage.textContent = 'No results found';
	emptyMessage.hidden = true;

	const input = document.createElement('input');
	input.type = 'search';
	input.className =
		'gl-form-input form-control gl-search-box-by-type-input-borderless';
	input.placeholder = 'Search';
	input.setAttribute('aria-label', 'Search jobs');
	input.addEventListener('input', () => {
		filterStageJobs(dropdown, input.value);
	});

	wrapper.append(createSearchIcon(), input);
	container.append(wrapper, emptyMessage);
	return container;
}

function setupStageDropdownSearch() {
	for (const dropdown of document.querySelectorAll(stageDropdownSelector)) {
		const title = dropdown.querySelector(
			'[data-testid="pipeline-stage-dropdown-menu-title"]',
		);
		if (!title) continue;

		const customSearch = dropdown.querySelector(`.${stageSearchClass}`);
		const hasNativeSearch = dropdown.querySelector(
			'.pipeline-mini-graph-search',
		);

		if (hasNativeSearch) {
			if (customSearch) {
				customSearch.remove();
				filterStageJobs(dropdown, '');
			}
			continue;
		}

		if (customSearch) {
			// Reapply the filter when GitLab re-renders the job list
			filterStageJobs(dropdown, customSearch.querySelector('input').value);
			continue;
		}

		title.after(createStageSearch(dropdown));
	}
}

// Clear the search when a stage dropdown is opened, like GitLab does for its own search
document.addEventListener(
	'click',
	event => {
		const toggle = event.target.closest(
			'[data-testid="pipeline-mini-graph-dropdown-toggle"]',
		);
		const searchInput = toggle
			?.closest(stageDropdownSelector)
			?.querySelector(`.${stageSearchClass} input`);
		if (!searchInput) return;

		searchInput.value = '';
		filterStageJobs(toggle.closest(stageDropdownSelector), '');
	},
	true,
);

const stageDropdownObserver = new MutationObserver(() => {
	setupStageDropdownSearch();
});

stageDropdownObserver.observe(document.body, {
	childList: true,
	subtree: true,
});

setupStageDropdownSearch();

// Always enable the "Show dependencies" toggle on pipeline pages.
// Only done once per pipeline so it can still be turned off manually
let showDependenciesEnabledForPath;

function findShowDependenciesToggle() {
	const toggleByTestId = document.querySelector(
		'[data-testid="show-links-toggle"]',
	);
	if (toggleByTestId) {
		return toggleByTestId.matches('button[role="switch"]')
			? toggleByTestId
			: toggleByTestId.querySelector('button[role="switch"]');
	}

	for (const toggle of document.querySelectorAll('button[role="switch"]')) {
		const label =
			toggle.closest('.gl-toggle-wrapper')?.textContent ??
			toggle.getAttribute('aria-label') ??
			'';
		if (label.includes('Show dependencies')) return toggle;
	}
}

function enableShowDependencies() {
	const {pathname} = globalThis.location;
	if (!/\/-\/pipelines\/\d+/.test(pathname)) return;
	if (showDependenciesEnabledForPath === pathname) return;

	const toggle = findShowDependenciesToggle();
	if (!toggle) return;

	showDependenciesEnabledForPath = pathname;
	if (toggle.getAttribute('aria-checked') !== 'true') {
		toggle.click();
	}
}

const showDependenciesObserver = new MutationObserver(() => {
	enableShowDependencies();
});

showDependenciesObserver.observe(document.body, {
	childList: true,
	subtree: true,
});

enableShowDependencies();

// Render conventional commit titles like Refined GitHub does.
// Example: "chore(ci): use production environments" becomes "[Chore] ci: use production environments"
const conventionalCommitTypes = new Map([
	['feat', {label: 'Feature', color: '#1fb6c9'}],
	['fix', {label: 'Fix', color: '#e5534b'}],
	['perf', {label: 'Performance', color: '#a371f7'}],
	['refactor', {label: 'Refactor', color: '#8b7cf6'}],
	['revert', {label: 'Revert', color: '#f0883e'}],
	['docs', {label: 'Docs', color: '#4493f8'}],
	['chore', {label: 'Chore', color: '#8b949e'}],
	['build', {label: 'Build', color: '#d29922'}],
	['ci', {label: 'CI', color: '#3fb950'}],
	['test', {label: 'Test', color: '#e3b341'}],
	['style', {label: 'Style', color: '#db61a2'}],
]);
const breakingChangeColor = '#f85149';

const conventionalCommitRegex =
	/^(?<type>\w+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s+(?<description>\S.*)$/s;

function parseConventionalCommit(title) {
	const groups = conventionalCommitRegex.exec(title)?.groups;
	const commitType = conventionalCommitTypes.get(groups?.type.toLowerCase());

	return (
		commitType && {
			...commitType,
			scope: groups.scope,
			isBreaking: Boolean(groups.breaking),
			description: groups.description,
		}
	);
}

function getFirstTextNode(element) {
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
		acceptNode: node =>
			node.textContent.trim() &&
			!node.parentElement.closest('.gitlab-extras-commit-scope')
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP,
	});
	return walker.nextNode();
}

function createCommitTypeBadge({label, color, isBreaking}) {
	const badge = document.createElement('span');
	badge.className = 'gitlab-extras-commit-type';
	badge.style.setProperty(
		'--gitlab-extras-commit-type-color',
		isBreaking ? breakingChangeColor : color,
	);
	badge.textContent = isBreaking ? `${label}!` : label;

	if (isBreaking) {
		badge.title = 'Breaking change';
	}

	return badge;
}

function createCommitScope(scope) {
	const scopeElement = document.createElement('span');
	scopeElement.className = 'gitlab-extras-commit-scope';
	scopeElement.textContent = `${scope}: `;
	return scopeElement;
}

function renderConventionalCommits() {
	for (const commitLink of document.querySelectorAll('a[href*="/-/commit/"]')) {
		const textNode = getFirstTextNode(commitLink);
		if (!textNode) continue;

		// The rendered title can itself look like a conventional commit, e.g. "ci: ..."
		if (textNode.textContent === commitLink.dataset.gitlabExtrasCommitTitle) {
			continue;
		}

		// Only handle links where the commit title is the start of the link text
		const existingScope = commitLink.querySelector(
			'.gitlab-extras-commit-scope',
		);
		let leadingText = commitLink.textContent.trimStart();
		if (existingScope && leadingText.startsWith(existingScope.textContent)) {
			leadingText = leadingText.slice(existingScope.textContent.length);
		}

		const title = textNode.textContent.trimStart();
		if (!leadingText.startsWith(title)) continue;

		const commit = parseConventionalCommit(title);
		if (!commit) continue;

		existingScope?.remove();
		textNode.textContent = commit.description;
		commitLink.dataset.gitlabExtrasCommitTitle = textNode.textContent;
		if (commit.scope) {
			textNode.before(createCommitScope(commit.scope));
		}

		const previousElement = commitLink.previousElementSibling;
		if (previousElement?.classList.contains('gitlab-extras-commit-type')) {
			previousElement.replaceWith(createCommitTypeBadge(commit));
		} else {
			commitLink.before(createCommitTypeBadge(commit));
		}
	}
}

const conventionalCommitsObserver = new MutationObserver(() => {
	renderConventionalCommits();
});

conventionalCommitsObserver.observe(document.body, {
	childList: true,
	subtree: true,
	characterData: true,
});

renderConventionalCommits();

document.addEventListener('keydown', event => {
	console.log('key down', event.key);

	// Ignore if typing in an input, textarea, or contenteditable
	if (
		event.target.tagName === 'INPUT' ||
		event.target.tagName === 'TEXTAREA' ||
		event.target.isContentEditable
	) {
		return;
	}

	// Approve PR using the "a" key (case-insensitive), and not a modifier key
	if (
		event.key.toLowerCase() === 'a' &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey
	) {
		event.stopPropagation();
		event.preventDefault();

		// Find the "Approve" button
		const approveButton = document.querySelector(
			'button[data-testid="approve-button"]',
		);

		if (approveButton && !approveButton.disabled) {
			approveButton.click();
		}
	}

	// Open the search bar using Ctrl/Cmd + K
	if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
		event.stopPropagation();
		event.preventDefault();

		const searchBar = document.querySelector('#super-sidebar-search');
		if (searchBar) {
			searchBar.click();
		}
	}

	// Toggle the MR/PR as draft/ready using the "d" key (case-insensitive), and not a modifier key
	if (
		event.key.toLowerCase() === 'd' &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey
	) {
		// Example: "/knutakir/knuts-gitlab-restroom/-/merge_requests/12/diffs"
		const match = globalThis.location.pathname.match(
			/^\/(.+?)\/-\/merge_requests\/(\d+)(?:\/|$)/,
		);
		if (!match) return;

		event.stopPropagation();
		event.preventDefault();

		// Held-down keys fire repeated keydown events
		if (event.repeat || isTogglingDraftStatus) return;

		const [, projectPath, mergeRequestNumber] = match;
		toggleDraftStatus(projectPath, mergeRequestNumber);
	}
});

let isTogglingDraftStatus = false;

async function gitlabGraphql(operationName, query, variables) {
	const token = document
		.querySelector('meta[name="csrf-token"]')
		?.getAttribute('content');

	const response = await fetch('https://gitlab.com/api/graphql', {
		headers: {
			'Content-Type': 'application/json',
			'X-CSRF-Token': token,
		},
		body: JSON.stringify({operationName, variables, query}),
		method: 'POST',
		mode: 'cors',
	});
	const data = await response.json();

	if (data.errors) {
		throw new Error(JSON.stringify(data.errors));
	}

	return data.data;
}

async function toggleDraftStatus(projectPath, mergeRequestNumber) {
	isTogglingDraftStatus = true;
	showLoader('Toggling draft status...');

	try {
		// Read the draft status from the API, as the page may not have rendered the status buttons yet
		const statusData = await gitlabGraphql(
			'getDraftStatus',
			'query getDraftStatus($projectPath: ID!, $iid: String!) { project(fullPath: $projectPath) { mergeRequest(iid: $iid) { draft } } }',
			{projectPath, iid: mergeRequestNumber},
		);
		const isDraft = statusData.project?.mergeRequest?.draft;
		if (typeof isDraft !== 'boolean') {
			throw new TypeError('Could not determine current draft status');
		}

		hideLoader();
		showLoader(isDraft ? 'Marking as ready...' : 'Marking as draft...');

		const toggleData = await gitlabGraphql(
			'toggleDraftStatus',
			'mutation toggleDraftStatus($projectPath: ID!, $iid: String!, $draft: Boolean!) { mergeRequestSetDraft(input: {projectPath: $projectPath, iid: $iid, draft: $draft}) { mergeRequest { id draft } errors } }',
			{projectPath, iid: mergeRequestNumber, draft: !isDraft},
		);
		const errors = toggleData.mergeRequestSetDraft?.errors;
		if (errors?.length > 0) {
			throw new Error(JSON.stringify(errors));
		}

		// TODO: Is it possible to do this without refreshing?
		// Keep the toggle lock and loader until the page reloads to avoid double toggles
		globalThis.location.reload();
	} catch (error) {
		console.error('Error toggling draft status:', error);
		hideLoader();
		isTogglingDraftStatus = false;
	}
}
