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
		event.stopPropagation();
		event.preventDefault();

		// Get project path and MR IID from the current URL
		const urlParts = globalThis.location.pathname.split('/');
		// This consist of user/group + project/repo. Example "knutakir/knuts-gitlab-restroom"
		const projectPath = urlParts.slice(1, -3).join('/');
		const mergeRequestNumber = urlParts.at(-1);

		// Get the current draft status from the page.
		// Currently just checks if the "Mark as ready" button is present.
		// TODO: improve this check
		const isDraft =
			document.querySelector('button[data-testid="mark-as-ready-button"]') !==
			null;

		// Show loader overlay with context-specific text
		showLoader(isDraft ? 'Marking as ready...' : 'Marking as draft...');

		// Get the CSRF token from the meta tag
		const token = document
			.querySelector('meta[name="csrf-token"]')
			?.getAttribute('content');

		// TODO: make async?
		fetch('https://gitlab.com/api/graphql', {
			headers: {
				'Content-Type': 'application/json',
				'X-CSRF-Token': token,
			},
			body: JSON.stringify({
				operationName: 'toggleDraftStatus',
				variables: {
					projectPath: projectPath,
					iid: mergeRequestNumber,
					draft: !isDraft,
				},
				query:
					'mutation toggleDraftStatus($projectPath: ID!, $iid: String!, $draft: Boolean!) {  mergeRequestSetDraft(    input: {projectPath: $projectPath, iid: $iid, draft: $draft}  ) {    mergeRequest {      id      mergeableDiscussionsState      title      draft      __typename    }    errors    __typename  }}',
			}),
			method: 'POST',
			mode: 'cors',
		})
			.then(response => response.json())
			.then(data => {
				console.log('data', data);

				if (data.errors) {
					console.error(
						'Error toggling draft status (data.errors):',
						data.errors,
					);
					hideLoader();
				} else if (data.data.errors) {
					console.error(
						'Error toggling draft status (data.data.errors):',
						data.data.errors,
					);
					hideLoader();
				} else {
					// TODO: Is it possible to do this without refreshing?
					// Refresh the page to show updated status
					globalThis.location.reload();
				}
			})
			.catch(error => {
				console.error('Error toggling draft status:', error);
				hideLoader();
			});
	}
});
