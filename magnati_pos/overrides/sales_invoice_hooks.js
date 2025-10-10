frappe.ui.form.on("Sales Invoice", {
	refresh(frm) {
		frm.events.setup_magnati_pos_button(frm);
	},

	is_pos(frm) {
		frm.events.setup_magnati_pos_button(frm);
	},

	is_return(frm) {
		frm.events.setup_magnati_pos_button(frm);
	},

	setup_magnati_pos_button(frm) {
		if (!frappe.boot.magnati_pos_enabled) {
			return;
		}

		if (frm.doc.docstatus == 0 && frm.doc.is_pos && !frm.doc.is_return) {
			frm.add_custom_button(__("Magnati POS Payment"), () => frm.events.request_magnati_pos_payment(frm));
		} else {
			frm.remove_custom_button(__("Magnati POS Payment"));
		}
	},

	async request_magnati_pos_payment(frm) {
		if (!frm.doc.is_pos) {
			frappe.throw(__("Sales Invoice must be a POS Invoice for Magnati POS Payment"));
		}
		if (frm.doc.is_return) {
			frappe.throw(__("Cannot receive Magnati POS Payment for Credit Notes"));
		}
		if (frm.doc.docstatus != 0) {
			frappe.throw(__("Sales Invoice must be in draft for Magnati POS Payment"));
		}
		if (frm.doc.currency != "AED") {
			frappe.throw(__("Only AED currency is allowed for Magnati POS Payments"));
		}

		let entered_amount;
		let reference_row = frm.events.get_magnati_payment_row(frm, frappe.boot.magnati_card_mop);
		if (reference_row) {
			entered_amount = flt(reference_row.amount);
		}

		let outstanding_amount = flt(frm.doc.outstanding_amount);

		let auth_obj = await magnati_pos.request_card_payment(frm, entered_amount || outstanding_amount);

		let row = frm.events.get_magnati_payment_row(frm, auth_obj.mode_of_payment);
		if (!row) {
			row = frm.add_child("payments");
		}

		frappe.model.set_value(row.doctype, row.name, "mode_of_payment", auth_obj.mode_of_payment);
		frappe.model.set_value(row.doctype, row.name, "amount", auth_obj.amount);
		frappe.model.set_value(row.doctype, row.name, "reference_no", auth_obj.reference_no);
		frappe.model.set_value(row.doctype, row.name, "card_type", auth_obj.card_type);
	},

	get_magnati_payment_row(frm, mode_of_payment) {
		return (frm.doc.payments || []).find(d => d.mode_of_payment == mode_of_payment && !d.reference_no);
	}
});
