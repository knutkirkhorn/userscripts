// ==UserScript==
// @name         GitLab Fix in Cursor
// @namespace    https://gitlab.com/
// @version      1.0.0
// @description  Add "Fix in Cursor" button to failed GitLab jobs
// @author       Knut Kirkhorn
// @match        https://gitlab.com/*/-/jobs/*
// @match        https://gitlab.com/*/-/pipelines/*
// ==/UserScript==

// TODO: fix these later:
/* eslint-disable unicorn/no-null */
/* eslint-disable unicorn/prefer-dom-node-text-content */

// TODO: add to mr/pr main page

(function () {
	const BUTTON_ID = 'fix-in-cursor-btn';
	const CURSOR_PROMPT_URL = 'cursor://anysphere.cursor-deeplink/prompt';

	const MAX_LOG_CHARS = 2000; // Reduced to keep overall prompt smaller
	const MAX_URL_CHARS = 8000;
	// Cursor's deep link handler has very strict limits - account for URL encoding expansion
	// URL encoding can expand text by ~3x for special characters, so we need to be very conservative
	// Testing shows Cursor rejects URLs with encoded text > ~2000-3000 chars
	const MAX_ENCODED_URL_CHARS = 2500; // Very conservative limit for encoded URL length
	const MAX_DECODED_PROMPT_CHARS = 2000; // Limit on decoded prompt text itself

	/**
	 * Check if the pipeline has failed
	 */
	function isPipelineFailed() {
		// Check for pipeline configuration errors first (these indicate failure even without jobs)
		const pipelineConfigError = extractPipelineConfigurationError();
		if (pipelineConfigError) return true;

		// Check for failed status indicators
		const failedBadge = document.querySelector(
			'.ci-status-icon-failed, [data-testid="status_failed_borderless-icon"], .ci-failed',
		);
		const statusText = document.querySelector('.ci-status-text, .status-text');

		if (failedBadge) return true;
		if (statusText && statusText.textContent.toLowerCase().includes('failed'))
			return true;

		// Check for warning status (failed deployments often show as warnings)
		const warningBadge = document.querySelector(
			'.ci-status-icon-warning, [data-testid="status_warning_borderless-icon"], .ci-warning, .ci-status-icon[class*="warning"]',
		);
		if (warningBadge) {
			// Check if there's error text indicating actual failure
			const pageText = document.body.textContent || document.body.innerText;
			if (
				/ERROR:.*Job failed|exit status 1|Job failed.*exit status/i.test(
					pageText,
				)
			) {
				return true;
			}
		}

		// Check for error text patterns in the page
		const pageText = document.body.textContent || document.body.innerText;
		if (
			/ERROR:.*Job failed|Job failed.*exit status 1|exit status 1/i.test(
				pageText,
			)
		) {
			return true;
		}

		// Check page title or header for failed status
		const pageTitle = document.querySelector(
			'.page-title, h1, .pipeline-header',
		);
		if (pageTitle && pageTitle.textContent.toLowerCase().includes('failed'))
			return true;

		// Check for any status badge that might indicate failure
		const allStatusBadges = document.querySelectorAll(
			'[class*="status"], [data-testid*="status"], .ci-status, .badge',
		);
		for (const badge of allStatusBadges) {
			const badgeText =
				badge.textContent || badge.getAttribute('aria-label') || '';
			if (
				badgeText.toLowerCase().includes('failed') ||
				badgeText.toLowerCase().includes('error')
			) {
				return true;
			}
		}

		// Check job log area for error messages (deployment jobs often show errors here)
		const logContainer = document.querySelector(
			'.job-log, .build-log, [data-testid="job-log-content"], pre.build-trace, .build-trace',
		);
		if (logContainer) {
			const logText = logContainer.textContent || logContainer.innerText;
			if (
				/ERROR:.*Job failed|Job failed.*exit status|exit status 1/i.test(
					logText,
				)
			) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Extract project path from URL
	 */
	function getProjectPath() {
		const match = globalThis.location.pathname.match(
			/^\/(.+?)\/-\/(pipelines|jobs)/,
		);
		return match ? match[1] : null;
	}

	/**
	 * Extract job ID from URL (if on job page)
	 */
	function getJobId() {
		const match = globalThis.location.pathname.match(/jobs\/(\d+)/);
		return match ? match[1] : null;
	}

	/**
	 * Get failed jobs from the pipeline page
	 */
	function getFailedJobs() {
		const failedJobs = [];

		// Find all job links with failed status
		const jobElements = document.querySelectorAll(
			'.ci-job-component, [data-testid="job-item"], .build-content',
		);

		for (const job of jobElements) {
			const isFailed =
				job.querySelector(
					'.ci-status-icon-failed, [data-testid="status_failed_borderless-icon"]',
				) || job.classList.contains('failed');

			if (isFailed) {
				const nameElement = job.querySelector(
					'.ci-job-name-text, .ci-build-text, .gl-text-truncate',
				);
				const linkElement = job.querySelector('a[href*="/jobs/"]');

				failedJobs.push({
					name: nameElement ? nameElement.textContent.trim() : 'Unknown job',
					url: linkElement ? linkElement.href : null,
				});
			}
		}

		return failedJobs;
	}

	/**
	 * Fetch job log from GitLab API or scrape from page
	 */
	async function getJobLog(jobUrl) {
		try {
			// Try to extract job ID and fetch log
			const jobIdMatch = jobUrl.match(/jobs\/(\d+)/);
			if (!jobIdMatch) return null;

			const jobId = jobIdMatch[1];
			const projectPath = getProjectPath();

			// Try API endpoint first
			const apiUrl = `https://gitlab.com/api/v4/projects/${encodeURIComponent(
				projectPath,
			)}/jobs/${jobId}/trace`;

			const response = await fetch(apiUrl, {
				credentials: 'include',
			});

			if (response.ok) {
				const log = await response.text();
				// Extract last 200 lines or error section
				return extractRelevantLogPart(log);
			}

			return null;
		} catch (error) {
			console.error('Failed to fetch job log:', error);
			return null;
		}
	}

	/**
	 * Extract the relevant error portion from a job log
	 */
	function extractRelevantLogPart(log) {
		const lines = log.split('\n');

		// Look for common error patterns
		const errorPatterns = [
			/error:/i,
			/failed:/i,
			/exception/i,
			/fatal:/i,
			/error\[/i,
			/\berror\b/i,
			/exit code [1-9]/i,
			/command failed/i,
			/build failed/i,
			/test failed/i,
			/npm ERR!/i,
			/yarn error/i,
			/pip error/i,
			/compilation failed/i,
		];

		// Find error lines and their context
		const errorLineIndices = [];
		for (const [index, line] of lines.entries()) {
			if (errorPatterns.some(pattern => pattern.test(line))) {
				errorLineIndices.push(index);
			}
		}

		if (errorLineIndices.length > 0) {
			// Get context around first error (20 lines before, 30 lines after)
			const firstErrorIndex = errorLineIndices[0];
			const startIndex = Math.max(0, firstErrorIndex - 20);
			const endIndex = Math.min(lines.length, firstErrorIndex + 30);

			const snippet = lines.slice(startIndex, endIndex).join('\n');

			if (snippet.length > MAX_LOG_CHARS) {
				console.log('Truncated2');
				return snippet.slice(-MAX_LOG_CHARS);
			}
			return snippet;
		}

		// If no error patterns found, return last 100 lines
		const tail = lines.slice(-100).join('\n');
		console.log('lines', lines);
		console.log('tail', tail);
		return tail.length > MAX_LOG_CHARS
			? tail.slice(0, MAX_LOG_CHARS) + '\n[Truncated1]\n'
			: tail;
	}

	/**
	 * Extract pipeline configuration errors from alert sections
	 */
	function extractPipelineConfigurationError() {
		// Look for alert sections with error messages
		const alertSection = document.querySelector(
			'.gl-alert-danger, .gl-alert[role="alert"], [data-testid="pipeline-error"]',
		);

		if (alertSection) {
			// Try to get error messages from list items
			const errorListItems = alertSection.querySelectorAll(
				'.gl-alert-body ul li, .alert-body ul li, ul li',
			);

			if (errorListItems.length > 0) {
				const errors = [...errorListItems]
					.map(li => li.textContent.trim())
					.filter(text => text.length > 0);

				if (errors.length > 0) {
					return errors.join('\n');
				}
			}

			// Fallback: get text from alert body
			const alertBody = alertSection.querySelector(
				'.gl-alert-body, .alert-body',
			);
			if (alertBody) {
				const errorText = alertBody.textContent.trim();
				if (errorText.length > 0) {
					return errorText;
				}
			}
		}

		// Also check for "yaml invalid" badge and related error messages
		const invalidBadge = document.querySelector(
			'[data-testid="badges-invalid"], [title*="yaml invalid"], [title*="does not exist"]',
		);
		if (invalidBadge) {
			const errorTitle = invalidBadge.getAttribute('title');
			if (errorTitle && errorTitle.length > 0) {
				return errorTitle;
			}
		}

		return null;
	}

	/**
	 * Scrape error info from the current job page
	 */
	function scrapeJobPageError() {
		// Try to get the job log content from the page
		const logContainer = document.querySelector(
			'.job-log, .build-log, [data-testid="job-log-content"], pre.build-trace',
		);

		if (logContainer) {
			const logText = logContainer.textContent || logContainer.innerText;
			return extractRelevantLogPart(logText);
		}

		return null;
	}

	/**
	 * Collect all error information
	 */
	async function collectErrorInfo() {
		// const projectPath = getProjectPath();
		// const pipelineId = getPipelineId();
		const jobId = getJobId();

		const errorInfo = {
			// projectPath,
			// pipelineId,
			jobId,
			pipelineUrl: globalThis.location.href,
			failedJobs: [],
			errorLog: null,
			pipelineConfigError: null,
		};

		console.log('jobId', jobId);

		// First, check for pipeline configuration errors (these take priority)
		errorInfo.pipelineConfigError = extractPipelineConfigurationError();

		// If on a job page, get the log directly
		if (jobId) {
			// Only get job log if we don't have a pipeline config error
			if (!errorInfo.pipelineConfigError) {
				errorInfo.errorLog = scrapeJobPageError();
			}

			// Get job name
			const jobNameElement = document.querySelector(
				'.job-header h1, .build-header h1, [data-testid="job-name"]',
			);
			if (jobNameElement) {
				errorInfo.failedJobs.push({
					name: jobNameElement.textContent.trim(),
					url: globalThis.location.href,
				});
			}
		} else {
			// On pipeline page, collect failed jobs
			errorInfo.failedJobs = getFailedJobs();

			// Try to get log from first failed job (only if no pipeline config error)
			if (
				!errorInfo.pipelineConfigError &&
				errorInfo.failedJobs.length > 0 &&
				errorInfo.failedJobs[0].url
			) {
				errorInfo.errorLog = await getJobLog(errorInfo.failedJobs[0].url);
			}
		}

		return errorInfo;
	}

	/**
	 * Generate the Cursor open URL with the error data
	 */
	function generateCursorOpenData(errorInfo) {
		let prompt = 'I get this error in the GitLab CI pipeline:';

		// Prioritize pipeline configuration errors over job logs
		if (errorInfo.pipelineConfigError) {
			prompt += `
\`\`\`
${errorInfo.pipelineConfigError}
\`\`\`
`;
		} else if (errorInfo.errorLog) {
			prompt += `
\`\`\`
${errorInfo.errorLog}
\`\`\`
`;
		}

		// Truncate prompt to ensure it stays within Cursor's strict limits
		// Cursor validates both decoded text length and encoded URL length
		let truncatedPrompt = prompt;

		console.log('truncatedPrompt.length', truncatedPrompt.length);

		// First, limit decoded prompt length
		if (truncatedPrompt.length > MAX_DECODED_PROMPT_CHARS) {
			truncatedPrompt = truncatedPrompt.slice(0, MAX_DECODED_PROMPT_CHARS);
		}

		// Then check and limit encoded URL length
		let encodedText = encodeURIComponent(truncatedPrompt);
		const baseUrlLength = CURSOR_PROMPT_URL.length + '?text='.length;
		let fullUrlLength = baseUrlLength + encodedText.length;

		// If encoded URL is too long, progressively truncate the prompt
		// Reduce decoded text until encoded URL fits
		let iterations = 0;
		while (
			fullUrlLength > MAX_ENCODED_URL_CHARS &&
			truncatedPrompt.length > 200 &&
			iterations < 10
		) {
			// Reduce by ~25% each iteration
			const targetLength = Math.floor(truncatedPrompt.length * 0.75);
			truncatedPrompt = truncatedPrompt.slice(0, targetLength);
			encodedText = encodeURIComponent(truncatedPrompt);
			fullUrlLength = baseUrlLength + encodedText.length;
			if (fullUrlLength <= MAX_ENCODED_URL_CHARS) break;
			iterations++;
		}

		const url = `${CURSOR_PROMPT_URL}?text=${encodedText}`;

		// Debug logging
		console.log('Cursor deep link generation:', {
			decodedLength: truncatedPrompt.length,
			encodedLength: encodedText.length,
			fullUrlLength: url.length,
			withinLimits:
				url.length <= MAX_ENCODED_URL_CHARS &&
				truncatedPrompt.length <= MAX_DECODED_PROMPT_CHARS,
		});

		return {
			url,
			isTooLong: url.length > MAX_URL_CHARS,
			prompt: truncatedPrompt,
		};
	}

	// eslint-disable-next-line consistent-return
	function copyToClipboard(text) {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			return navigator.clipboard.writeText(text);
		}
	}

	const fixInCursorButtonHTML = `
        <span class="gl-button-text" style="display: flex; align-items: center;">
            <svg id="Ebene_1" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 466.73 532.09"
                style="padding-right: 4px;"
            >
                <!-- Generator: Adobe Illustrator 29.6.1, SVG Export Plug-In . SVG Version: 2.1.1 Build 9)  -->
                <defs>
                    <style>
                    .st0 {
                        fill: #edecec;
                    }
                    </style>
                </defs>
                <path class="st0" d="M457.43,125.94L244.42,2.96c-6.84-3.95-15.28-3.95-22.12,0L9.3,125.94c-5.75,3.32-9.3,9.46-9.3,16.11v247.99c0,6.65,3.55,12.79,9.3,16.11l213.01,122.98c6.84,3.95,15.28,3.95,22.12,0l213.01-122.98c5.75-3.32,9.3-9.46,9.3-16.11v-247.99c0-6.65-3.55-12.79-9.3-16.11h-.01ZM444.05,151.99l-205.63,356.16c-1.39,2.4-5.06,1.42-5.06-1.36v-233.21c0-4.66-2.49-8.97-6.53-11.31L24.87,145.67c-2.4-1.39-1.42-5.06,1.36-5.06h411.26c5.84,0,9.49,6.33,6.57,11.39h-.01Z"/>
            </svg>
            Fix in Cursor
        </span>
    `;

	/**
	 * Create and add the "Fix in Cursor" button
	 */
	function addFixInCursorButton(container) {
		// Remove existing button if present
		// eslint-disable-next-line unicorn/prefer-query-selector
		const existingButton = document.getElementById(BUTTON_ID);
		if (existingButton) {
			existingButton.remove();
		}

		// Create button
		const button = document.createElement('button');
		button.id = BUTTON_ID;
		button.className = 'btn btn-confirm gl-button';
		button.innerHTML = fixInCursorButtonHTML;

		button.style.cssText = `
		    margin-top: 6px;
		    background-color: black;
		    border-color: black;
		    color: white;
		`;

		button.addEventListener('click', async () => {
			button.disabled = true;
			button.querySelector('.gl-button-text').textContent = 'Loading...';

			try {
				const errorInfo = await collectErrorInfo();
				const cursorData = generateCursorOpenData(errorInfo);

				console.log(errorInfo);

				// For debugging purposes
				// await copyToClipboard(cursorData.prompt);
				// await copyToClipboard(cursorData.url);
				// alert("Copied to clipboard");

				// return; // TODO: debug

				if (cursorData.isTooLong) {
					await copyToClipboard(cursorData.prompt);
					alert(
						'Prompt is too long for a URL. It has been copied to the clipboard. Cursor will open without data.',
					);
					window.open(CURSOR_PROMPT_URL, '_blank');
					return;
				}

				// Open in new tab
				window.open(cursorData.url, '_blank');
			} catch (error) {
				console.error('Error collecting pipeline info:', error);
				alert(
					'Failed to collect pipeline error information. Check console for details.',
				);
			} finally {
				button.disabled = false;
				button.innerHTML = fixInCursorButtonHTML;
			}
		});

		container.append(button);
	}

	/**
	 * Find the best container to add the button
	 */
	function findButtonContainer() {
		// Try various selectors for GitLab's action buttons area
		const selectors = [
			'.ci-header-container .header-action-buttons',
			'.page-content-header .header-action-buttons',
			'.ci-header-container .ci-actions',
			'.pipeline-header-actions',
			'.header-action-buttons',
			'.job-header .ci-actions',
			'.build-header .header-action-buttons',
			'[data-testid="pipeline-actions"]',
			'.gl-display-flex.gl-gap-3', // Common GitLab flex container for buttons
		];

		for (const selector of selectors) {
			const container = document.querySelector(selector);
			if (container) {
				return container;
			}
		}

		// Fallback: create our own container near the page header
		const header = document.querySelector(
			'.page-content-header, .ci-header-container, .content-wrapper .container-fluid',
		);
		if (header) {
			const container = document.createElement('div');
			container.style.cssText =
				'display: flex; align-items: center; margin: 10px 0;';
			header.insertBefore(container, header.firstChild);
			return container;
		}

		return null;
	}

	/**
	 * Main initialization
	 */
	async function init() {
		// Wait for page to load
		await new Promise(resolve => setTimeout(resolve, 1500));

		// Check if pipeline/job has failed
		if (!isPipelineFailed()) {
			console.log(
				'GitLab Fix in Cursor: Pipeline has not failed, not adding button.',
			);
			return;
		}

		console.log(
			'GitLab Fix in Cursor: Failed pipeline detected, adding button...',
		);

		// Find container and add button
		const container = findButtonContainer();
		if (container) {
			addFixInCursorButton(container);
			console.log('GitLab Fix in Cursor: Button added successfully.');
		} else {
			console.error(
				'GitLab Fix in Cursor: Could not find suitable container for button.',
			);
		}
	}

	// Run on page load
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	// Also watch for SPA navigation (GitLab uses Turbo/Turbolinks)
	const observer = new MutationObserver(() => {
		// Debounce re-initialization
		clearTimeout(globalThis._fixInCursorTimeout);
		globalThis._fixInCursorTimeout = setTimeout(() => {
			// eslint-disable-next-line unicorn/prefer-query-selector
			if (!document.getElementById(BUTTON_ID)) {
				init();
			}
		}, 1000);
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});
})();
