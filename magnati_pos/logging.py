import frappe
from frappe.integrations.utils import create_request_log


@frappe.whitelist()
def log_request(
	data,
	output,
	request_id=None,
	reference_doctype=None,
	reference_name=None,
	error=None,
):
	return create_request_log(
		data,
		output=output,
		service_name="Magnati POS",
		request_id=request_id,
		error=error,
		status="Failed" if error else "Completed",
		reference_doctype=reference_doctype,
		reference_docname=reference_name,
	).name
