import frappe
from frappe.utils import cint


def boot_session(bootinfo):
	if frappe.session['user'] != 'Guest':
		settings = frappe.get_single("Magnati POS Settings")
		bootinfo.ecr_web_service_url = settings.ecr_web_service_url
		bootinfo.magnati_card_mop = settings.magnati_card_mop
		bootinfo.magnati_pos_enabled = cint(settings.enabled)
		bootinfo.magnati_visa_card_type = settings.visa_card_type
		bootinfo.magnati_master_card_type = settings.master_card_type
		bootinfo.magnati_amex_card_type = settings.amex_card_type
