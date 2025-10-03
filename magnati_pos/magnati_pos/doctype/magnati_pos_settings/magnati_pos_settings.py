# Copyright (c) 2025, ParaLogic and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class MagnatiPOSSettings(Document):
	def on_update(self):
		frappe.cache.delete_key("bootinfo")
