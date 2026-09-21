(() => {
	const launcher = document.getElementById("pfa-help-launcher");
	if (!launcher || !window.PFA_USER) return;

	function loadScript(src) {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = src;
			script.onload = resolve;
			script.onerror = () => reject(new Error(`Unable to load ${src}`));
			document.head.appendChild(script);
		});
	}

	launcher.addEventListener("click", async () => {
		if (launcher.disabled) return;

		launcher.disabled = true;
		launcher.textContent = "…";
		launcher.setAttribute("aria-label", "Loading PFA Help");

		try {
			await loadScript("https://cdn.botpress.cloud/webchat/v3.7/inject.js");

			// Register the existing user-data and snapshot handlers
			// before the configuration initialises Webchat.
			await loadScript(launcher.dataset.wrapperUrl);

			window.botpress.on("webchat:initialized", () => {
				window.botpress.open();
				launcher.remove();
			});

			await loadScript(
				"https://files.bpcontent.cloud/2026/09/18/17/20260918173241-QA73J62W.js",
			);
		} catch (error) {
			console.error("PFA Help Bot V2: loading failed.", error);
			launcher.textContent = "!";
			launcher.setAttribute(
				"aria-label",
				"PFA Help could not load. Refresh the page to retry.",
			);
		}
	});
})();
