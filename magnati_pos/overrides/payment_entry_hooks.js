frappe.ui.form.on("Payment Entry", {
	refresh(frm) {
		frm.events.setup_magnati_pos_button(frm);
	},

	payment_type(frm) {
		frm.events.setup_magnati_pos_button(frm);
	},

	setup_magnati_pos_button(frm) {
		if (frm.doc.docstatus == 0 && frm.doc.payment_type == "Receive") {
			frm.add_custom_button(__("Magnati POS Payment"), () => frm.events.request_magnati_pos_payment(frm));
		} else {
			frm.remove_custom_button(__("Magnati POS Payment"));
		}
	},

	async request_magnati_pos_payment(frm) {
		if (frm.doc.payment_type != "Receive") {
			frappe.throw(__("Payment Type must be 'Receive' for Magnati POS Payment"));
		}
		if (frm.doc.docstatus != 0) {
			frappe.throw(__("Payment Entry must be in draft for Magnati POS Payment"));
		}
		if (frm.doc.paid_to_account_currency && frm.doc.paid_to_account_currency != "AED") {
			frappe.throw(__("Only AED currency is allowed for Magnati POS Payments"));
		}

		let auth_obj = await magnati_pos.request_card_payment(frm, frm.doc.paid_amount_after_tax);
		frm.set_value("mode_of_payment", auth_obj.mode_of_payment);
		frm.set_value("paid_amount", auth_obj.amount);
		frm.set_value("reference_no", auth_obj.reference_no);
		frm.set_value("card_type", auth_obj.card_type);
	}
});
