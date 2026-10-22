// %%staffnonote 0 hides a staff on any line where it has no notes. The parser does that by taking the staff
// out of line.staff, so that nothing draws it, and keeping it in line.hiddenStaffs with the position it had.
//
// Anything that follows a voice through the tune by its position on each line — the audio and the timing —
// has to see the hidden staffs too, or every staff after a hidden one is read as the voice above it, and the
// hidden voice loses the time of that line. This puts them back where they were.
//
// Returns [{ staff: staff, hidden: boolean }] in the order the staffs had before any were hidden.
function allStaffs(line) {
	var staffs = line.staff || [];
	var hiddenStaffs = line.hiddenStaffs || [];
	var result = [];
	var visible = 0;
	var hidden = 0;
	var total = staffs.length + hiddenStaffs.length;
	for (var position = 0; position < total; position++) {
		if (hidden < hiddenStaffs.length && hiddenStaffs[hidden].staffIndex === position) {
			result.push({ staff: hiddenStaffs[hidden].staff, hidden: true });
			hidden++;
		} else {
			result.push({ staff: staffs[visible], hidden: false });
			visible++;
		}
	}
	return result;
}

function anyHiddenStaffs(lines) {
	for (var i = 0; i < lines.length; i++) {
		if (lines[i].hiddenStaffs && lines[i].hiddenStaffs.length > 0)
			return true;
	}
	return false;
}

module.exports = { allStaffs: allStaffs, anyHiddenStaffs: anyHiddenStaffs };
