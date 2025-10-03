import frappe


def after_install():
	add_magnati_pos_setup_navbar_item()


def add_magnati_pos_setup_navbar_item():
	if frappe.db.exists("Navbar Item", {"item_label": "Setup Magnati POS"}):
		return

	navbar_settings = frappe.get_single("Navbar Settings")
	settings_items = navbar_settings.as_dict().settings_dropdown

	seperator_item_idx = -1
	for i, item in enumerate(navbar_settings.settings_dropdown):
		if item.get("item_type") == "Separator" and item.get("is_standard"):
			seperator_item_idx = i

	new_items = frappe.get_hooks("standard_navbar_items", app_name="magnati_pos")

	settings_items[seperator_item_idx:seperator_item_idx] = new_items

	navbar_settings.set("settings_dropdown", settings_items)
	navbar_settings.save()
