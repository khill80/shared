// Function to capture dynamic DOM context on page load
function getDetailedDOMSnapshot() {
	const clean = (value) =>
		String(value ?? "")
			.replace(/\s+/g, " ")
			.trim();

	const referencedText = (ids) =>
		clean(
			String(ids ?? "")
				.split(/\s+/)
				.filter(Boolean)
				.map((id) => document.getElementById(id)?.textContent ?? "")
				.join(" "),
		);

	const label = (el) =>
		clean(el.getAttribute("data-ai-label")) ||
		referencedText(el.getAttribute("aria-labelledby")) ||
		clean(el.getAttribute("aria-label")) ||
		clean(
			Array.from(el.labels ?? [])
				.map((x) => x.textContent)
				.join(" "),
		) ||
		clean(el.innerText || el.textContent) ||
		clean(el.getAttribute("title")) ||
		clean(el.getAttribute("placeholder")) ||
		el.getAttribute("name") ||
		el.id ||
		"";

	const visible = (el) => {
		const style = getComputedStyle(el);
		return (
			el.getClientRects().length > 0 &&
			style.visibility !== "hidden" &&
			style.visibility !== "collapse"
		);
	};

	const describe = (el) => ({
		label: label(el),
		id: el.id || null,
		name: el.getAttribute("name"),
		tag: el.tagName.toLowerCase(),
		role: el.getAttribute("role"),
		visible: visible(el),
		disabled:
			el.matches(":disabled") || !!el.closest('[aria-disabled="true"], [inert]'),
		ariaHidden: !!el.closest('[aria-hidden="true"]'),
		ariaExpanded: el.getAttribute("aria-expanded"),
		ariaCurrent: el.getAttribute("aria-current"),
		ariaControls: el.getAttribute("aria-controls"),
		ariaHaspopup: el.getAttribute("aria-haspopup"),
	});

	const navSelector = 'nav, [role="navigation"], .navbar';
	const navRoots = Array.from(document.querySelectorAll(navSelector)).filter(
		(el) => !el.parentElement?.closest(navSelector),
	);

	const menuParent = (el) => {
		const menu = el.parentElement?.closest('.dropdown-menu, [role="menu"]');
		if (!menu) return null;

		const controller = menu.id
			? Array.from(document.querySelectorAll("[aria-controls]")).find((control) =>
					(control.getAttribute("aria-controls") || "")
						.split(/\s+/)
						.includes(menu.id),
				)
			: null;

		const toggle =
			controller ||
			menu.parentElement?.querySelector(
				":scope > .dropdown-toggle, :scope > [aria-haspopup]",
			);

		return (
			referencedText(menu.getAttribute("aria-labelledby")) ||
			(toggle ? label(toggle) : null)
		);
	};

	const destination = (el) => {
		const href = el.getAttribute("href");
		if (!href || href.startsWith("#")) return null;

		try {
			const url = new URL(href, location.href);
			return url.origin === location.origin ? url.pathname : null;
		} catch {
			return null;
		}
	};

	return {
		url: location.pathname,
		capturedAt: new Date().toISOString(),
		title: document.title,

		headings: Array.from(document.querySelectorAll("h1, h2, h3"))
			.filter(visible)
			.map((el) => clean(el.textContent))
			.filter(Boolean)
			.slice(0, 50),

		navigation: navRoots.map((nav) => ({
			label: label(nav).slice(0, 120),
			items: Array.from(
				nav.querySelectorAll('a, button, [role="menuitem"], [role="button"]'),
			).map((el) => ({
				...describe(el),
				parentMenu: menuParent(el),
				path: destination(el),
			})),
		})),

		inputs: Array.from(
			document.querySelectorAll('input:not([type="hidden"]), select, textarea'),
		)
			.filter(visible)
			.map((el) => ({
				...describe(el),
				type: el.getAttribute("type"),
				required: el.required || el.getAttribute("aria-required") === "true",
			}))
			.slice(0, 200),

		buttons: Array.from(
			document.querySelectorAll('button, .btn, [role="button"]'),
		)
			.filter(
				(el) =>
					visible(el) && !el.closest(navSelector) && el.id !== "pfa-help-launcher",
			)
			.map(describe)
			.slice(0, 200),
	};
}

function getDOMSnapshot() {
	const snapshot = getDetailedDOMSnapshot();

	// Remove the navbar label that repeats its menu contents.
	snapshot.navigation = snapshot.navigation.map((nav) => ({
		items: nav.items,
	}));

	function compact(value) {
		if (Array.isArray(value)) {
			return value.map(compact);
		}

		if (value && typeof value === "object") {
			return Object.fromEntries(
				Object.entries(value)
					.filter(([key, val]) => {
						if (val === null || val === undefined || val === "") {
							return false;
						}

						// These omitted states mean false.
						if (
							["disabled", "ariaHidden", "required"].includes(key) &&
							val === false
						) {
							return false;
						}

						return true;
					})
					.map(([key, val]) => [key, compact(val)]),
			);
		}

		return value;
	}

	return compact(snapshot);
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
				roles: JSON.stringify(user.roles ?? []),
				regions: JSON.stringify(user.regions ?? []),
			},
		});

		// Tell Botpress that the user's details are available.
		await window.botpress.sendEvent({
			type: "pfa_user_ready",
			pageContext: getDOMSnapshot(),
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
