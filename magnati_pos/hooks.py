app_name = "magnati_pos"
app_title = "Magnati POS"
app_publisher = "ParaLogic"
app_description = "Magnati POS Terminal Integration"
app_email = "info@paralogic.io"
app_license = "gpl-3.0"

after_install = "magnati_pos.install.after_install"

app_include_js = "magnati_pos.bundle.js"

boot_session = "magnati_pos.boot.boot_session"

doctype_js = {
	"Payment Entry": "overrides/payment_entry.js",
	"Sales Invoice": "overrides/sales_invoice.js",
}

standard_navbar_items = [
	{
		"item_label": "Setup Magnati POS",
		"item_type": "Action",
		"action": "magnati_pos.show_magnati_pos_config_dialog()",
		"condition": "frappe.boot.magnati_pos_enabled && (frappe.model.can_create('Payment Entry') || frappe.model.can_create('Sales Invoice'))",
		"is_standard": 1,
	},
]
