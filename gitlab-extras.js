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
`;
document.head.append(style);

// Loader helper functions
function showLoader() {
	const overlay = document.createElement('div');
	overlay.className = 'gitlab-extras-loader-overlay';
	overlay.id = 'gitlab-extras-loader';
	const text = document.createElement('div');
	text.className = 'gitlab-extras-loader-text';
	text.textContent = 'Loading...';
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

function isOnMergeRequestsPage() {
	return (
		globalThis.location.pathname.endsWith('/-/merge_requests/') ||
		globalThis.location.pathname.endsWith('/-/merge_requests')
	);
}

// Create an observer for the MR list
const mrObserver = new MutationObserver(() => {
	if (isOnMergeRequestsPage()) {
		updateMRStyling();
	}
});

// Start observing the MR list
mrObserver.observe(document.body, {
	childList: true,
	subtree: true,
});

// Initial styling
if (isOnMergeRequestsPage()) {
	updateMRStyling();
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

		// Show loader overlay
		showLoader();

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
