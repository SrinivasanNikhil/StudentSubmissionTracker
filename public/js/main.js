// Main JavaScript file for SQL Practice application

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
							// Show error message
							alert(
								"Error: " + (data.message || "Failed to update question status")
							);
							submitButton.disabled = false;

							// Reset button text
							submitButton.innerHTML = isCompleted
								? "<i class='bi bi-x-circle'></i> Mark as Incomplete"
								: "<i class='bi bi-check-circle'></i> Mark as Completed";
						}
					})
					.catch((error) => {
						console.error("Error:", error);
						alert("An error occurred. Please try again.");
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

	// Auto-dismiss alerts after 5 seconds
	const alerts = document.querySelectorAll(".alert:not(.alert-success)");
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
