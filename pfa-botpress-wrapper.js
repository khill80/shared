// Function to capture dynamic DOM context on page load
function getDOMSnapshot() {
	return {
		url: window.location.pathname,
		menuOptions: Array.from(
			document.querySelectorAll(".sidebar-menu a, .nav-link"),
		)
			.map((el) => el.textContent.trim())
			.filter(Boolean),
		inputs: Array.from(document.querySelectorAll("input, select, textarea"))
			.map((el) => el.name || el.id)
			.filter(Boolean),
		buttons: Array.from(document.querySelectorAll("button, .btn"))
			.map((el) => el.textContent.trim())
			.filter(Boolean),
	};
}

// Fire events once Botpress v3 Webchat is loaded and active
window.botpress.on("webchat:ready", async () => {
	if (!window.PFA_USER) return;

	const user = window.PFA_USER;

	try {
		await window.botpress.updateUser({
			name: user.name,
			data: {
				firstName: user.firstName,
				company: user.company,
				roles: user.roles,
				regions: user.regions,
			},
		});

		// Tell Botpress that the user's details are available.
		await window.botpress.sendEvent({
			type: "pfa_user_ready",
		});

		await window.botpress.sendEvent({
			type: "page_snapshot",
			payload: getDOMSnapshot(),
		});
	} catch (error) {
		console.error("PFA Help Bot V2: initialisation failed.", error);
	}
});

// Listen for element highlighting commands sent from Botpress
window.botpress.on("customEvent", (event) => {
	if (event.action === "highlight" && event.elementId) {
		const el =
			document.getElementById(event.elementId) ||
			document.querySelector(`[name="${event.elementId}"]`);
		if (el) {
			el.classList.add("botpress-highlight-glow");
			el.scrollIntoView({ behavior: "smooth", block: "center" });
			setTimeout(() => el.classList.remove("botpress-highlight-glow"), 5000);
		}
	}
});
