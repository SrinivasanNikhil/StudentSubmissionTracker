// Main JavaScript file for SQL Practice application

// Global toast notification system
window.sstToast = function(type, message, duration) {
	if (duration === undefined) duration = 4000;
	const container = document.getElementById('sst-toast-container');
	if (!container) return;
	const icons = {
		success: 'check-circle-fill',
		error: 'exclamation-triangle-fill',
		warning: 'exclamation-circle',
		info: 'info-circle'
	};
	const colors = {
		success: 'text-bg-success',
		error: 'text-bg-danger',
		warning: 'text-bg-warning',
		info: 'text-bg-info'
	};
	const toast = document.createElement('div');
	toast.className = 'toast show align-items-center border-0 ' + (colors[type] || colors.info);
	toast.setAttribute('role', 'alert');

	const outer = document.createElement('div');
	outer.className = 'd-flex';

	const body = document.createElement('div');
	body.className = 'toast-body d-flex align-items-center gap-2';

	const icon = document.createElement('i');
	icon.className = 'bi bi-' + (icons[type] || icons.info);

	const text = document.createElement('span');
	text.textContent = String(message);

	body.append(icon, text);

	const closeBtn = document.createElement('button');
	closeBtn.type = 'button';
	closeBtn.className = 'btn-close btn-close-white me-2 m-auto';
	closeBtn.addEventListener('click', function() { toast.remove(); });

	outer.append(body, closeBtn);
	toast.appendChild(outer);
	container.appendChild(toast);
	if (duration > 0) setTimeout(function() { toast.remove(); }, duration);
};

document.addEventListener("DOMContentLoaded", function () {
	// Handle completion form submission via AJAX if available
	const completionForms = document.querySelectorAll(
		'form[action^="/completions/questions/"]'
	);

	completionForms.forEach((form) => {
		form.addEventListener("submit", function (e) {
			// Only use AJAX if the browser supports it
			if (window.fetch) {
				e.preventDefault();

				const questionId = form.action.split("/").pop();
				const submitButton = form.querySelector('button[type="submit"]');
				const isCompleted = submitButton.classList.contains(
					"btn-outline-secondary"
				);

				// Disable the button to prevent multiple submissions
				submitButton.disabled = true;
				submitButton.innerHTML = isCompleted
					? '<i class="bi bi-hourglass"></i> Marking as incomplete...'
					: '<i class="bi bi-hourglass"></i> Marking as completed...';

				// Send the completion request
				fetch(form.action, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Requested-With": "XMLHttpRequest",
					},
					credentials: "same-origin",
				})
					.then((response) => response.json())
					.then((data) => {
						if (data.success) {
							// Update the UI to show new completion status
							const badge = document.querySelector(".badge");
							if (badge) {
								if (data.completed) {
									badge.className = "badge bg-success";
									badge.textContent = "Completed";

									// Update button to "Mark as Incomplete"
									submitButton.className =
										"btn btn-outline-secondary toggle-completion";
									submitButton.innerHTML =
										"<i class='bi bi-x-circle'></i> Mark as Incomplete";
								} else {
									badge.className = "badge bg-secondary";
									badge.textContent = "Not Completed";

									// Update button to "Mark as Completed"
									submitButton.className = "btn btn-success toggle-completion";
									submitButton.innerHTML =
										"<i class='bi bi-check-circle'></i> Mark as Completed";
								}
							}

							// Enable the button again
							submitButton.disabled = false;
						} else {
							window.sstToast('error', data.message || 'Failed to update question status');
							submitButton.disabled = false;

							// Reset button text
							submitButton.innerHTML = isCompleted
								? "<i class='bi bi-x-circle'></i> Mark as Incomplete"
								: "<i class='bi bi-check-circle'></i> Mark as Completed";
						}
					})
					.catch((error) => {
						console.error("Error:", error);
						window.sstToast('error', 'An error occurred. Please try again.');
						submitButton.disabled = false;

						// Reset button text
						submitButton.innerHTML = isCompleted
							? "<i class='bi bi-x-circle'></i> Mark as Incomplete"
							: "<i class='bi bi-check-circle'></i> Mark as Completed";
					});
			}
			// If fetch is not supported, the form will submit normally
		});
	});

	// Auto-dismiss flash alerts after 5 seconds — scoped to #flash-messages only
	// so inline functional alerts (SQL errors, solution lock, deadline warnings) are unaffected
	const alerts = document.querySelectorAll("#flash-messages .alert:not(.alert-success)");
	alerts.forEach((alert) => {
		setTimeout(() => {
			alert.style.opacity = "0";
			alert.style.transition = "opacity 1s";

			setTimeout(() => {
				alert.remove();
			}, 1000);
		}, 5000);
	});
});
