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

// Highlight page elements using data-ai-label or navbar text.
(() => {
	const clean = (value) =>
		String(value ?? "")
			.replace(/\s+/g, " ")
			.trim();

	const navSelector = 'nav, [role="navigation"], .navbar';

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
		clean(el.innerText || el.textContent);

	const parentMenu = (el) => {
		const menu = el.parentElement?.closest('.dropdown-menu, [role="menu"]');

		if (!menu) return "";

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
			(toggle ? label(toggle) : "")
		);
	};

	const visible = (el) => {
		const style = getComputedStyle(el);

		return (
			el.isConnected &&
			el.getClientRects().length > 0 &&
			style.visibility !== "hidden" &&
			style.visibility !== "collapse" &&
			!el.closest('[hidden], [aria-hidden="true"], [inert]')
		);
	};

	if (!document.getElementById("pfa-highlight-style")) {
		const style = document.createElement("style");
		style.id = "pfa-highlight-style";
		style.textContent = `
	        .pfa-ai-highlight {
		        outline: 3px solid #38bdf8 !important;
		        outline-offset: 4px !important;
	        }
        `;
		document.head.appendChild(style);
	}

	// Dim the page while leaving the target and Botpress chat clear.
	const svgNS = "http://www.w3.org/2000/svg";
	let spotlight = null;
	let spotlightFrame = null;

	const svgElement = (name, attributes = {}) => {
		const el = document.createElementNS(svgNS, name);

		for (const [key, value] of Object.entries(attributes)) {
			el.setAttribute(key, String(value));
		}

		return el;
	};

	const stopSpotlight = () => {
		cancelAnimationFrame(spotlightFrame);
		spotlightFrame = null;
		spotlight?.remove();
		spotlight = null;
	};

	const startSpotlight = (target) => {
		stopSpotlight();

		const maskId = `pfa-spotlight-${Date.now()}`;

		spotlight = svgElement("svg", {
			"aria-hidden": "true",
			focusable: "false",
		});

		Object.assign(spotlight.style, {
			position: "fixed",
			inset: "0",
			width: "100%",
			height: "100%",
			zIndex: "2147483647",
			pointerEvents: "none",
		});

		const defs = svgElement("defs");
		const mask = svgElement("mask", {
			id: maskId,
			maskUnits: "userSpaceOnUse",
			maskContentUnits: "userSpaceOnUse",
			x: 0,
			y: 0,
		});

		const background = svgElement("rect", { fill: "white" });
		const holes = svgElement("g", { fill: "black" });

		mask.append(background, holes);
		defs.append(mask);

		const shade = svgElement("rect", {
			fill: "black",
			"fill-opacity": "0.45",
			mask: `url(#${maskId})`,
		});

		spotlight.append(defs, shade);
		document.body.append(spotlight);

		const update = () => {
			if (!spotlight || !target.isConnected) {
				stopSpotlight();
				return;
			}

			const width = window.innerWidth;
			const height = window.innerHeight;

			for (const el of [mask, background, shade]) {
				el.setAttribute("width", width);
				el.setAttribute("height", height);
			}

			// Find Botpress's chat and launcher on the host page.
			// Reading iframe contents is not required.
			const chatElements = [
				...document.querySelectorAll(".bpWebchat, .bpFab"),
				...Array.from(document.querySelectorAll("iframe")).filter((frame) => {
					const description = [
						frame.src,
						frame.title,
						frame.id,
						frame.className,
					].join(" ");

					return /botpress|webchat/i.test(description);
				}),
			];

			const clearAreas = [
				{ element: target, padding: 9 },
				...chatElements.map((element) => ({ element, padding: 3 })),
			];

			holes.replaceChildren();

			for (const { element, padding } of clearAreas) {
				const rect = element.getBoundingClientRect();
				const style = getComputedStyle(element);

				if (
					!rect.width ||
					!rect.height ||
					style.visibility === "hidden" ||
					style.display === "none"
				) {
					continue;
				}

				holes.append(
					svgElement("rect", {
						x: rect.left - padding,
						y: rect.top - padding,
						width: rect.width + padding * 2,
						height: rect.height + padding * 2,
						rx: 8,
					}),
				);
			}

			spotlightFrame = requestAnimationFrame(update);
		};

		update();
	};

	let activeElement = null;
	let timer = null;

	window.pfaHighlight = (request) => {
		if (!request || typeof request !== "object") return false;

		if (request.page && request.page !== location.pathname) {
			console.warn("PFA highlight: request is for another page.");
			return false;
		}

		if (typeof request.label !== "string" || !clean(request.label)) {
			console.warn("PFA highlight: missing target label.");
			return false;
		}

		let matches = [];

		if (request.by === "aiLabel") {
			matches = Array.from(document.querySelectorAll("[data-ai-label]")).filter(
				(el) => clean(el.getAttribute("data-ai-label")) === clean(request.label),
			);

			if (request.aiRole) {
				matches = matches.filter(
					(el) => el.getAttribute("data-ai-role") === request.aiRole,
				);
			}
		} else if (request.by === "navText") {
			matches = Array.from(
				document.querySelectorAll('a, button, [role="menuitem"], [role="button"]'),
			).filter(
				(el) =>
					el.closest(navSelector) &&
					clean(el.innerText || el.textContent) === clean(request.label) &&
					(request.parentMenu === undefined ||
						parentMenu(el) === clean(request.parentMenu)),
			);
		}

		matches = matches.filter(visible);

		if (matches.length !== 1) {
			console.warn(
				"PFA highlight: expected one visible match.",
				request,
				matches.length,
			);
			return false;
		}

		clearTimeout(timer);
		activeElement?.classList.remove("pfa-ai-highlight");

		const el = matches[0];
		activeElement = el;

		el.classList.add("pfa-ai-highlight");
		el.scrollIntoView({
			behavior: "instant",
			block: "nearest",
			inline: "nearest",
		});

		startSpotlight(el);

		timer = setTimeout(() => {
			stopSpotlight();
			el.classList.remove("pfa-ai-highlight");
			if (activeElement === el) activeElement = null;
		}, 4000);

		return true;
	};

	window.botpress.on("customEvent", (event) => {
		if (event?.action !== "highlight") return;

		console.log("PFA highlight request:", event);
		const success = window.pfaHighlight(event);
		console.log("PFA highlight displayed:", success);
	});
})();
