// ==UserScript==
// @name     Extra shortcuts and improvements for GitLab
// @version  1
// @grant    none
// @match https://gitlab.com/*
// ==/UserScript==

// Add SAML session expiration detection.
// Refresh the page if the SAML modal is shown.
const observer = new MutationObserver((mutations) => {
	// Finds the div that is not the outer modal div (does not contains id "___BV_modal_outer_")
	const samlModal = document.querySelector(
		"[id^='reload-saml-modal']:not([id$='___BV_modal_outer_'])",
	);
	console.log("debug: samlModal", samlModal);

	if (samlModal) {
		console.log(
			"debug: if check: ",
			samlModal &&
				samlModal.getAttribute("aria-label") ===
					"Your SAML session has expired" &&
				samlModal.classList.contains("show"),
		);
		console.log(
			"debug: samlModal.getAttribute('aria-label')",
			samlModal.getAttribute("aria-label"),
		);
		console.log(
			"debug: samlModal.classList.contains('show')",
			samlModal.classList.contains("show"),
		);
	}

	if (
		samlModal &&
		samlModal.getAttribute("aria-label") === "Your SAML session has expired" &&
		samlModal.classList.contains("show")
	) {
		console.log("SAML session expired, refreshing page");
		window.location.reload();
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
		window.location.pathname.includes("/-/merge_requests");
	const isIssuesPage = window.location.pathname.includes("/-/issues");

	if (!isMergeRequestsPage && !isIssuesPage) return;

	const searchInput = document.querySelector(
		'input[data-testid="filtered-search-term-input"]',
	);
	if (!searchInput) return;

	searchInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
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
const searchObserver = new MutationObserver((mutations) => {
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
const style = document.createElement("style");
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
document.head.appendChild(style);

// Loader helper functions
function showLoader() {
	const overlay = document.createElement("div");
	overlay.className = "gitlab-extras-loader-overlay";
	overlay.id = "gitlab-extras-loader";
	const text = document.createElement("div");
	text.className = "gitlab-extras-loader-text";
	text.textContent = "Loading...";
	overlay.appendChild(text);
	document.body.appendChild(overlay);
}

function hideLoader() {
	const overlay = document.getElementById("gitlab-extras-loader");
	if (overlay) {
		overlay.remove();
	}
}

// Function to update MR/PR styling
function updateMRStyling() {
	const mrRows = document.querySelectorAll(".merge-request");

	mrRows.forEach((row) => {
		// Remove existing custom classes
		row.classList.remove("mr-draft", "mr-ready");

		// Check if MR is draft
		const isDraft = row
			.querySelector(".issue-title-text")
			.textContent.trim()
			.startsWith("Draft: ");

		// Add class to MR row
		if (isDraft) {
			row.classList.add("mr-draft");
		} else {
			row.classList.add("mr-ready");
		}
	});
}

function isOnMergeRequestsPage() {
	return (
		window.location.pathname.endsWith("/-/merge_requests/") ||
		window.location.pathname.endsWith("/-/merge_requests")
	);
}

// Create an observer for the MR list
const mrObserver = new MutationObserver((mutations) => {
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

document.addEventListener("keydown", function (e) {
	console.log("key down", e.key);

	// Ignore if typing in an input, textarea, or contenteditable
	if (
		e.target.tagName === "INPUT" ||
		e.target.tagName === "TEXTAREA" ||
		e.target.isContentEditable
	) {
		return;
	}

	// Approve PR using the "a" key (case-insensitive), and not a modifier key
	if (e.key.toLowerCase() === "a" && !e.ctrlKey && !e.metaKey && !e.altKey) {
		e.stopPropagation();
		e.preventDefault();

		// Find the "Approve" button
		const approveButton = document.querySelector(
			'button[data-testid="approve-button"]',
		);

		if (approveButton && !approveButton.disabled) {
			approveButton.click();
		}
	}

	// Open the search bar using Ctrl/Cmd + K
	if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
		e.stopPropagation();
		e.preventDefault();

		const searchBar = document.querySelector("#super-sidebar-search");
		if (searchBar) {
			searchBar.click();
		}
	}

	// Toggle the MR/PR as draft/ready using the "d" key (case-insensitive), and not a modifier key
	if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey && !e.altKey) {
		e.stopPropagation();
		e.preventDefault();

		// Show loader overlay
		showLoader();

		// Get project path and MR IID from the current URL
		const urlParts = window.location.pathname.split("/");
		// This consist of user/group + project/repo. Example "knutakir/knuts-gitlab-restroom"
		const projectPath = urlParts.slice(1, -3).join("/");
		const mergeRequestNumber = urlParts[urlParts.length - 1];

		// Get the current draft status from the page.
		// Currently just checks if the "Mark as ready" button is present.
		// TODO: improve this check
		const isDraft =
			document.querySelector('button[data-testid="mark-as-ready-button"]') !==
			null;

		// Get the CSRF token from the meta tag
		const token = document
			.querySelector('meta[name="csrf-token"]')
			?.getAttribute("content");

		// TODO: make async?
		fetch("https://gitlab.com/api/graphql", {
			headers: {
				"Content-Type": "application/json",
				"X-CSRF-Token": token,
			},
			body: JSON.stringify({
				operationName: "toggleDraftStatus",
				variables: {
					projectPath: projectPath,
					iid: mergeRequestNumber,
					draft: !isDraft,
				},
				query:
					"mutation toggleDraftStatus($projectPath: ID!, $iid: String!, $draft: Boolean!) {  mergeRequestSetDraft(    input: {projectPath: $projectPath, iid: $iid, draft: $draft}  ) {    mergeRequest {      id      mergeableDiscussionsState      title      draft      __typename    }    errors    __typename  }}",
			}),
			method: "POST",
			mode: "cors",
		})
			.then((response) => response.json())
			.then((data) => {
				console.log("data", data);

				if (data.errors) {
					console.error(
						"Error toggling draft status (data.errors):",
						data.errors,
					);
					hideLoader();
				} else if (data.data.errors) {
					console.error(
						"Error toggling draft status (data.data.errors):",
						data.data.errors,
					);
					hideLoader();
				} else {
					// TODO: Is it possible to do this without refreshing?
					// Refresh the page to show updated status
					window.location.reload();
				}
			})
			.catch((error) => {
				console.error("Error toggling draft status:", error);
				hideLoader();
			});
	}
});
