function parsePythonDict(dictStr) {
	dictStr = dictStr.split("\n").join('');
	dictStr = dictStr.trim();

	if (!dictStr.startsWith("attributes = {")) {
		throw 'Not a python dict.';
	}

	let striped = dictStr.substring(14,dictStr.length-1);

	/// string \'[\s\w\*\.\*]*\'
	/// decimal number \d+
	/// list \[[\'\s\w\*\.,]*\]
	/// dict attributes\s*=\s*\{[\'\s\w\*\.,]*\}
	let attributes = striped.split(/\s*(\'[\s\w\*\.]*\'|\d+|\[[\'\s\w\*\.,]*\])\s*:\s*(\'[\s\w\*\.]*\'|\d+|\[[\'\s\w\*\.,]*\])\s*,*/); 

	for (let i=attributes.length-1; i>=0;i--) {
		if (attributes[i].length == 0) {
			attributes.splice(i,1);
		}
	}

	let pythonDict = {};

	for (let i=0; i<attributes.length; i+=2) {
		pythonDict[parsePythonData(attributes[i])] = parsePythonData(attributes[i+1]);
	}

	return pythonDict;
}

function parsePythonData(rawData) {
	rawData = rawData.trim();

	if (rawData.startsWith("[") && rawData.endsWith("]")) {
		let arr = [];
		for (const elem of rawData.substring(2,rawData.length-2).split(',')) {
			let data = parsePythonData(elem);
			arr.push(data);
		}

		return arr;
	} else if (rawData.startsWith("\'") && rawData.endsWith("\'")) {
		return rawData.substring(1,rawData.length-1);
	} else if (rawData.includes('.')) {
		return parseFloat(rawData);
	} else {
		return parseInt(rawData);
	}
}