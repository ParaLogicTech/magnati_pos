frappe.provide("magnati_pos");

$.extend(magnati_pos, {
	in_request: false,

	request_card_payment(frm, amount) {
		magnati_pos.check_magnati_pos_enabled();
		magnati_pos.check_in_request();

		if (frm.is_new()) {
			frappe.throw(__("Please save the document in draft first before initiating Magnati POS Payment"));
		}
		if (frm.doc.docstatus == 2) {
			frappe.throw(__("Cannot initiate Magnati POS Payment on cancelled documents"));
		}

		let pos_terminals = magnati_pos.get_pos_terminals();
		if (!pos_terminals.length) {
			magnati_pos.show_magnati_pos_config_dialog();
			frappe.show_alert({
				message: __("Please setup Magnati POS Terminal list first"),
				indicator: "orange",
			});
			return;
		}

		let terminal_options = [];
		for (let t of pos_terminals) {
			terminal_options.push({
				label: `${t.terminal_label} (ID: ${t.terminal_id})`,
				value: t.terminal_id,
			});
		}

		let default_terminal = pos_terminals.length == 1 ? pos_terminals[0].terminal_id : null;

		amount = flt(amount, 2);

		return new Promise((resolve, reject) => {
			const dialog = new frappe.ui.Dialog({
				title: __("Initiate POS Payment"),
				static: true,
				minimizable: true,
				fields: [
					{
						label: __("Amount (AED)"),
						fieldname: "amount",
						fieldtype: "Currency",
						options: "Company:company:default_currency",
						default: amount || null,
						precision: 2,
						reqd: 1,
					},
					{
						label: __("POS Terminal"),
						fieldname: "terminal_id",
						fieldtype: "Select",
						options: terminal_options,
						default: default_terminal,
						reqd: 1,
					},
				],
				on_hide: () => {
					if (!magnati_pos.in_request) {
						reject("Cancelled by User");
					}
				}
			});

			dialog.set_primary_action(__("Initiate"), () => {
				magnati_pos.check_in_request();

				let values = dialog.get_values();

				if (flt(values.amount, 2) <= 0) {
					frappe.throw(__("Amount must be greater than zero"));
				}

				dialog.disable_primary_action();
				dialog.get_primary_btn().prepend(`<i class="fa fa-spinner fa-spin" style="margin-right: 2px;"></i>`);
				for (let f of Object.keys(dialog.fields_dict)) {
					dialog.set_df_property(f, "read_only", 1);
				}
				dialog.get_primary_btn().attr("disabled", "disabled");
				dialog.get_close_btn().hide();

				return magnati_pos.initiate_card_payment(
					flt(values.amount),
					values.terminal_id,
					frm.doc.doctype,
					frm.doc.name,
				).then((auth_obj) => {
					resolve(auth_obj);
				}).catch((e) => {
					reject(e);
				}).finally(() => {
					dialog.hide();
				});
			});

			dialog.show();
		});
	},

	async initiate_card_payment(amount, terminal_id, document_type, document_no) {
		magnati_pos.check_magnati_pos_enabled();

		amount = flt(amount, 2);
		if (amount <= 0) {
			throw new Error(__("POS Payment amount must a positive amount"));
		}
		if (!terminal_id) {
			throw new Error(__("Terminal ID not provided"));
		}
		if (!document_no || !document_type) {
			throw new Error(__("Document not provided"));
		}

		const headers = new Headers();
		headers.append("Content-Type", "text/xml; charset=utf-8");

		const payload = magnati_pos.get_payload(terminal_id, document_no, amount);

		const request_options = {
			method: "POST",
			headers: headers,
			body: payload,
			redirect: "follow"
		};

		frappe.show_alert({
			message: __('Initiating Magnati POS Payment...'),
			indicator: 'blue'
		});

		let message;
		try {
			magnati_pos.in_request = true;
			let url = magnati_pos.get_ecr_web_service_url();
			let response = await fetch(url, request_options);
			if (!response.ok) {
				throw new Error(`HTTP Error (${response.status}): ${response.response.statusText || ""}`);
			}
			message = await response.text();
		} catch (error) {
			frappe.msgprint({
				message: __("Error Communicating with Magnati POS Device: {0}", [error.message]),
				indicator: "red"
			});
			throw error;
		} finally {
			magnati_pos.in_request = false;
		}

		try {
			let auth_obj = magnati_pos.handle_message(message);

			frappe.show_alert({
				message: __('Magnati POS Payment Successful'),
				indicator: 'green'
			});

			magnati_pos.log_request(
				payload,
				message,
				document_type,
				document_no,
				auth_obj,
				null,
			);

			return auth_obj;
		} catch (error) {
			frappe.msgprint({
				message: __(error.message || "An unknown error occured while communicating with the Magnati POS Device"),
				indicator: "red"
			});

			magnati_pos.log_request(
				payload,
				message,
				document_type,
				document_no,
				null,
				error.message || "Unknown Error",
			);

			throw error;
		}
	},

	get_payload(terminal_id, document_no, amount) {
		let amount_in_cents = cint(amount * 100);

		return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
	<soap:Body>
		<Web_VFI_GetAuth xmlns="http://tempuri.org/">
			<Amount>${amount_in_cents}</Amount>
			<TerminalId>${terminal_id}</TerminalId>
			<TransType>1</TransType>
			<TxnComplitionAmount></TxnComplitionAmount>
			<TIPAmount></TIPAmount>
			<OrgionalRcptNum></OrgionalRcptNum>
			<ECRRcptNum>${document_no}</ECRRcptNum>
			<RetRefNo></RetRefNo>
		</Web_VFI_GetAuth>
	</soap:Body>
</soap:Envelope>`;
	},

	handle_message(message) {
		if (!message) {
			throw new Error("Received an empty message from Magnati POS Device");
		}

		const auth_obj = magnati_pos.parse_message(message);
		if (auth_obj["VFI_RespCode"] != "000") {
			throw new Error(__("Magnati POS Payment Failed: {0}", [auth_obj["VFI_RespMess"] || "Unknown Error"]))
		}

		auth_obj.amount = flt(flt(auth_obj["VFI_Amount"]) / 100, 2);

		auth_obj.reference_no = cstr(auth_obj["VFI_RetRefNo"]);
		auth_obj.reference_no = auth_obj.reference_no.replace(/^0+/, '');

		auth_obj.mode_of_payment = frappe.boot.magnati_card_mop;

		let card_scheme = cstr(auth_obj["VFI_CardSchemeName"]).toLowerCase();
		auth_obj.card_type = null;
		if (card_scheme == "visa") {
			auth_obj.card_type = frappe.boot.magnati_visa_card_type;
		} else if (["master", "mastercard"].includes(card_scheme)) {
			auth_obj.card_type = frappe.boot.magnati_master_card_type;
		} else if (["american express", "americanexpress", "amex"].includes(card_scheme)) {
			auth_obj.card_type = frappe.boot.magnati_amex_card_type;
		}

		return auth_obj;
	},

	parse_message(message) {
		const parser = new DOMParser();
		const xml_doc = parser.parseFromString(message, "text/xml");
		const auth_result = xml_doc.querySelector("Web_VFI_GetAuthResult");
		return magnati_pos.element_to_object(auth_result);
	},

	element_to_object(element) {
		let obj = {}
		for (let c of element.children) {
			obj[c.tagName] = c.textContent;
		}
		return obj;
	},

	log_request(request, response, document_type, document_no, auth_obj, error) {
		return frappe.call({
			method: "magnati_pos.logging.log_request",
			args: {
				data: request,
				output: response,
				request_id: auth_obj ? auth_obj["VFI_RetRefNo"] : null,
				reference_doctype: document_type,
				reference_name: document_no,
				error: error,
			},
		});
	},

	check_in_request() {
		if (magnati_pos.in_request) {
			frappe.throw(__("There is an active connection with Magnati POS, please wait"));
		}
	},

	check_magnati_pos_enabled() {
		if (!frappe.boot.magnati_pos_enabled) {
			frappe.throw(__("Magnati POS is disabled"));
		}
	},

	get_ecr_web_service_url() {
		const base_url = new URL(frappe.boot.ecr_web_service_url || 'http://localhost/');
		let path = "ECRWebService/ECRWebService.asmx";
		let full_url = new URL(path, base_url);
		return full_url.href;
	},

	get_pos_terminals() {
		let config = magnati_pos.get_magnati_pos_config();
		return config.pos_terminals || [];
	},

	show_magnati_pos_config_dialog() {
		let doc = magnati_pos.get_magnati_pos_config();

		let table_fields = [
			{
				label: __("Terminal ID"),
				fieldname: "terminal_id",
				fieldtype: "Data",
				reqd: 1,
				in_list_view: 1,
				columns: 3,
			},
			{
				label: __("Terminal Label"),
				fieldname: "terminal_label",
				fieldtype: "Data",
				in_list_view: 1,
				reqd: 1,
				columns: 7,
			},
		];

		let fields = [
			{
				label: __("POS Terminals"),
				fieldtype: "Section Break",
			},
			{
				label: __("POS Terminals"),
				fieldtype: "Table",
				fields: table_fields,
				data: doc.pos_terminals,
			},
		];

		const dialog = new frappe.ui.Dialog({
			title: __("Magnati POS Configuration"),
			fields: fields,
			doc: doc,
		});

		dialog.set_primary_action(__("Update Configuration"), () => {
			let new_config = {
				pos_terminals: (doc.pos_terminals || [])
					.filter(d => d.terminal_id && d.terminal_label)
					.map(d => {
						return {"terminal_id": d.terminal_id, "terminal_label": d.terminal_label}
					})
			};

			localStorage.magnati_pos_config = JSON.stringify(new_config);
			dialog.hide();

			frappe.show_alert({
				message: __("Magnati POS Configuration Updated"),
				indicator: "green",
			});
		});

		dialog.show();
	},

	get_magnati_pos_config() {
		let magnati_pos_config = {};
		if (localStorage.magnati_pos_config) {
			try {
				magnati_pos_config = JSON.parse(localStorage.magnati_pos_config);
			} catch {}
		}
		if (!magnati_pos_config.pos_terminals) {
			magnati_pos_config.pos_terminals = [];
		}

		return magnati_pos_config;
	},
});
