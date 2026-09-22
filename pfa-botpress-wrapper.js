function getDetailedDOMSnapshot() {
	const clean = (value) =>
		String(value ?? "")
			.replace(/\s+/g, " ")
			.trim();

	const navSelector = 'nav, [role="navigation"], .navbar';
	const boxSelector = '[data-ai-role="databox"], .databox';

	const visible = (el) => {
		const style = getComputedStyle(el);

		return (
			el.getClientRects().length > 0 &&
			style.visibility !== "hidden" &&
			style.visibility !== "collapse" &&
			!el.closest("[hidden]")
		);
	};

	const referencedText = (ids) =>
		clean(
			String(ids ?? "")
				.split(/\s+/)
				.filter(Boolean)
				.map((id) => document.getElementById(id)?.textContent ?? "")
				.join(" "),
		);

	// Do not use a select's option text as the control's label.
	const label = (el) =>
		clean(el.getAttribute("data-ai-label")) ||
		referencedText(el.getAttribute("aria-labelledby")) ||
		clean(el.getAttribute("aria-label")) ||
		clean(
			Array.from(el.labels ?? [])
				.map((x) => x.textContent)
				.join(" "),
		) ||
		(el.matches("input, select, textarea")
			? ""
			: clean(el.innerText || el.textContent)) ||
		clean(el.getAttribute("title")) ||
		clean(el.getAttribute("placeholder")) ||
		el.getAttribute("name") ||
		el.id ||
		"";

	const boxes = Array.from(document.querySelectorAll(boxSelector)).filter(
		visible,
	);

	// Find a heading belonging to this box, not a nested box.
	const boxHeading = (box) =>
		Array.from(
			box.querySelectorAll('.databox-head, [data-ai-role="section"], h1, h2, h3'),
		).find((el) => el.closest(boxSelector) === box);

	const boxTitle = (box) => {
		const heading = boxHeading(box);

		return (
			clean(box.getAttribute("data-ai-label")) ||
			referencedText(box.getAttribute("aria-labelledby")) ||
			clean(box.getAttribute("aria-label")) ||
			(heading ? label(heading) : "") ||
			box.id ||
			"Untitled databox"
		);
	};

	const sectionFor = (el) => {
		const box = el.closest(boxSelector);
		const index = boxes.indexOf(box);

		return index >= 0 ? `databox-${index + 1}` : null;
	};

	const describe = (el) => ({
		label: label(el),
		aiLabel: el.getAttribute("data-ai-label"),
		aiRole: el.getAttribute("data-ai-role"),
		id: el.id || null,
		name: el.getAttribute("name"),
		tag: el.tagName.toLowerCase(),
		role: el.getAttribute("role"),
		section: sectionFor(el),
		visible: visible(el),
		disabled:
			el.matches(":disabled") || !!el.closest('[aria-disabled="true"], [inert]'),
		ariaHidden: !!el.closest('[aria-hidden="true"]'),
		ariaExpanded: el.getAttribute("aria-expanded"),
		ariaCurrent: el.getAttribute("aria-current"),
		ariaControls: el.getAttribute("aria-controls"),
		ariaHaspopup: el.getAttribute("aria-haspopup"),
	});

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

	const navRoots = Array.from(document.querySelectorAll(navSelector)).filter(
		(el) => !el.parentElement?.closest(navSelector),
	);

	const inputElements = Array.from(
		document.querySelectorAll('input:not([type="hidden"]), select, textarea'),
	).filter(visible);

	const buttonElements = Array.from(
		document.querySelectorAll('button, .btn, [role="button"]'),
	).filter(
		(el) =>
			visible(el) && !el.closest(navSelector) && el.id !== "pfa-help-launcher",
	);

	const describeInput = (el) => {
		const result = {
			...describe(el),
			type: el.type || el.getAttribute("type"),
			required: el.required || el.getAttribute("aria-required") === "true",
		};

		if (el.tagName === "SELECT") {
			const options = Array.from(el.options);

			result.multiple = el.multiple;
			result.selected = options
				.filter((option) => option.selected)
				.map((option) => clean(option.label));

			result.options = options.slice(0, 100).map((option) => ({
				label: clean(option.label),
				selected: option.selected,
				disabled: option.disabled || !!option.closest("optgroup[disabled]"),
				group:
					option.parentElement?.tagName === "OPTGROUP"
						? option.parentElement.label
						: null,
			}));

			result.optionCount = options.length;
			result.optionsTruncated = options.length > 100;
		}

		// No text-input or textarea values are collected.
		return result;
	};

	return {
		url: location.pathname,
		capturedAt: new Date().toISOString(),
		title: document.title,

		headings: Array.from(
			document.querySelectorAll(
				'h1, h2, h3, .databox-head, [data-ai-role="section"]',
			),
		)
			.filter(visible)
			.map((el) => ({
				label: label(el),
				aiLabel: el.getAttribute("data-ai-label"),
				id: el.id || null,
				section: sectionFor(el),
			}))
			.filter((item) => item.label)
			.slice(0, 100),

		databoxes: boxes.map((box, index) => {
			const heading = boxHeading(box);

			return {
				ref: `databox-${index + 1}`,
				title: boxTitle(box),
				id: box.id || null,
				aiLabel: box.getAttribute("data-ai-label"),
				heading: heading
					? {
							label: label(heading),
							aiLabel: heading.getAttribute("data-ai-label"),
							id: heading.id || null,
						}
					: null,
			};
		}),

		navigation: navRoots.map((nav) => ({
			items: Array.from(
				nav.querySelectorAll('a, button, [role="menuitem"], [role="button"]'),
			).map((el) => ({
				...describe(el),
				parentMenu: menuParent(el),
				path: destination(el),
			})),
		})),

		inputs: inputElements.slice(0, 200).map(describeInput),
		buttons: buttonElements.slice(0, 200).map(describe),

		truncated: {
			inputs: inputElements.length > 200,
			buttons: buttonElements.length > 200,
		},
	};
}

function getDOMSnapshot() {
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

						if (
							[
								"disabled",
								"ariaHidden",
								"required",
								"multiple",
								"optionsTruncated",
							].includes(key) &&
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

	return compact(getDetailedDOMSnapshot());
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
