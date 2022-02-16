class Bundle extends BaseVisualization {
	///// Lighting consts /////
	static 	_material = glMatrix.vec4.fromValues(1.0, 0.8, 0.7, 5.0);

	constructor(intId, shaderMap, file) {
		super(intId);

		this._validFileExtensions = new Map([
										['bundles', () => this._readBundle()]//,
										// [ 'tck', () => this._readTck()],
										// [ 'trk', () => this._readTrk()]
										]);

		this._type += Bundle.name;

		this._curvesCount = 0;
		this._bundlesNames = [];
		this._bundlesStart = [];

		this._vertices = null;
		this._normals = null;
		this._colorIds = null;

		this._elements = null;
		this._fiberSizes = [];

		this._dim = glMatrix.vec3.create();
		this._center = glMatrix.vec3.create();

		this._colorTable = null;
		this._hColorTableTexture = null;

		///////////////////////////////
		///// EBO segmentation /////
		this._selectedBundles = [];
		this._fiberPercentage = 100.0;
		this._elementLength = 0;

		///////////////////////////////

		// File info
		this._path = file;
		this._name = file.substring(file.lastIndexOf('/')+1, file.lastIndexOf('.'));

		// Shaders info
		this._shaders = shaderMap[this._type];
		this._shaderN = this._shaders.length; // No hay geometry shader en WebGL 2.0

		this._boundingBox = new BoundingBox(shaderMap, [0,0,0], [0,0,0]);

		// Read and prepare array buffers
		this.finishingTouches();
	}

	async finishingTouches() {
		await this.readData();
		this.createColorTable();
		this.loadOpenGLData();

		this._draw = true;
		this._drawBB = true;

		this._boundingBox.updateBBModel(this._dim, this._center);

		console.log("Loading ready "+ this._name +" with "+ this._curvesCount +
			" fibers and "+ this._bundlesNames.length +" bundles.");
	}

	loadOpenGLData() {
		this.loadColorTexture();
		this.loadGLBuffers();
		this.vertexAttribPointer();
		this.updateEBO();
	}

	async readData() {
		let extension = this._path.substring(this._path.lastIndexOf('.')+1,this._path.length);

		if (this._validFileExtensions.has(extension)) {
			await this._validFileExtensions.get(extension)();
		}
		else { throw 'Reader for extension not implemented! Extension: '+extension; }
	}

	async _readBundle() {
		await this.readBundleHeader();
		await this.readBundleBody();
	}

	async readBundleHeader() {
		let data = await loadFile(this._path,'text');
		let headerDict = parsePythonDict(data);

		this._curvesCount = headerDict.curves_count;

		for (let i=0; i<headerDict.bundles.length; i+=2) {
			this._bundlesNames.push(headerDict.bundles[i]);
			this._bundlesStart.push(headerDict.bundles[i+1]);
			this._selectedBundles.push(true);
		}

		this._bundlesStart.push(this._curvesCount);
	}

	async readBundleBody() {
		let buffer = await loadFile(this._path+"data", 'arrayBuffer');
		let bufferIntView = new Int32Array(buffer);
		let bufferFloatView = new Float32Array(buffer);

		let dataSize = buffer.byteLength;

		this._vertices = new Float32Array(dataSize/4-this._curvesCount);
		this._normals = new Float32Array(dataSize/4-this._curvesCount);
		this._colorIds = new Int32Array((dataSize/4-this._curvesCount)/3);

		this._elements = new Uint32Array((dataSize/4-this._curvesCount)/3+this._curvesCount);
		this._elementLength = this._elements.length;

		let elementsIndex = 0;
		let index = 0;
		let normal = [1.0, 1.0, 1.0];
		let norma = 1.0;
		let bufferIndex = 0;
		let primitiveRestartIndex = 0xFFFFFFFF;

		let xmin = Infinity, xmax = -Infinity;
		let ymin = Infinity, ymax = -Infinity;
		let zmin = Infinity, zmax = -Infinity;

		for (let i=0; i<this._bundlesNames.length; i++) {
			for (let j=this._bundlesStart[i]; j<this._bundlesStart[i+1]; j++) {
				let currentSize = bufferIntView[bufferIndex++];
				this._fiberSizes.push(currentSize);
				this._vertices.set(bufferFloatView.subarray(bufferIndex,bufferIndex+currentSize*3), index*3);

				bufferIndex += currentSize*3;

				for (let k=0; k<currentSize-1; k++) {
					if (this._vertices[index*3]<xmin) { xmin = this._vertices[index*3]; }
					else if (this._vertices[index*3]>xmax) { xmax = this._vertices[index*3]; }

					if (this._vertices[index*3+1]<ymin) { ymin = this._vertices[index*3+1]; }
					else if (this._vertices[index*3+1]>ymax) { ymax = this._vertices[index*3+1]; }

					if (this._vertices[index*3+2]<zmin) { zmin = this._vertices[index*3+2]; }
					else if (this._vertices[index*3+2]>zmax) { zmax = this._vertices[index*3+2]; }

					normal[0] = this._vertices[(index+1)*3] - this._vertices[(index)*3];
					normal[1] = this._vertices[(index+1)*3+1] - this._vertices[(index)*3+1];
					normal[2] = this._vertices[(index+1)*3+2] - this._vertices[(index)*3+2];

					norma = Math.sqrt(normal[0]*normal[0]+normal[1]*normal[1]+normal[2]*normal[2]);

					this._normals.set(normal,index*3);
					this._colorIds[index] = i;

					this._elements[elementsIndex++] = index++;
				}

				if (this._vertices[index*3]<xmin) { xmin = this._vertices[index*3]; }
				else if (this._vertices[index*3]>xmax) { xmax = this._vertices[index*3]; }

				if (this._vertices[index*3+1]<ymin) { ymin = this._vertices[index*3+1]; }
				else if (this._vertices[index*3+1]>ymax) { ymax = this._vertices[index*3+1]; }

				if (this._vertices[index*3+2]<zmin) { zmin = this._vertices[index*3+2]; }
				else if (this._vertices[index*3+2]>zmax) { zmax = this._vertices[index*3+2]; }

				this._normals.set(normal,index*3);
				this._colorIds[index] = i;

				this._elements[elementsIndex++] = index++;
				this._elements[elementsIndex++] = primitiveRestartIndex;
			}
		}	

		this._dim[0] = (xmax-xmin);
		this._dim[1] = (ymax-ymin);
		this._dim[2] = (zmax-zmin);

		this._center[0] = xmin + this._dim[0]/2;
		this._center[1] = ymin + this._dim[1]/2;
		this._center[2] = zmin + this._dim[2]/2;
	}

	calculateDimCenter() {
		let xmin = this._vertices[0], xmax = this._vertices[0];
		let ymin = this._vertices[1], ymax = this._vertices[1];
		let zmin = this._vertices[2], zmax = this._vertices[2];

		for (let i=0; i<this._vertices.length; i+=3) {
			if (this._vertices[i]<xmin) { xmin = this._vertices[i]; }
			else if (this._vertices[i]>xmax) { xmax = this._vertices[i]; }

			if (this._vertices[i+1]<ymin) { ymin = this._vertices[i+1]; }
			else if (this._vertices[i+1]>ymax) { ymax = this._vertices[i+1]; }

			if (this._vertices[i+2]<zmin) { zmin = this._vertices[i+2]; }
			else if (this._vertices[i+2]>zmax) { zmax = this._vertices[i+2]; }
		}

		this._dim[0] = (xmax-xmin);
		this._dim[1] = (ymax-ymin);
		this._dim[2] = (zmax-zmin);

		this._center[0] = xmin + this._dim[0]/2;
		this._center[1] = ymin + this._dim[1]/2;
		this._center[2] = zmin + this._dim[2]/2;
	}

	get validFileExtension() {
		return this._validFileExtensions;
	}

	createColorTable() {
		////////// Y si utilizo otro que no sea Float32Array?
		this._colorTable = new Float32Array(this._bundlesNames.length*4);

		for (let i=0; i<this._bundlesNames.length; i++) {
			this._colorTable[ i*4 ] = Math.random()*0.7 + 0.3;
			this._colorTable[i*4+1] = Math.random()*0.7 + 0.3;
			this._colorTable[i*4+2] = Math.random()*0.7 + 0.3;
			this._colorTable[i*4+3] = 1.0;
		}
	}

	loadColorTexture() {
		if (this._hColorTableTexture == null) {
			this._hColorTableTexture = gl.createTexture();
		}

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._hColorTableTexture);


		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		// let bgColor = [1.0, 1.0, 1.0, 1.0];
		// gl.texParameterfv(gl.TEXTURE_2D, gl.TEXTURE_BORDER_COLOR, new Float32Array(bgColor), 0);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this._bundlesNames.length, 1, 0, gl.RGBA, gl.FLOAT, this._colorTable, 0);
	}

	loadGLBuffers() {
		this._vao.push(gl.createVertexArray());

		for (let i=0; i<3; i++) {
			this._vbo.push(gl.createBuffer());
		}
		this._ebo.push(gl.createBuffer());
		
		gl.bindVertexArray(this._vao[0]);

		// VBO
		// Vertex Data
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[0]);
		// console.log(this._vertices);
		// gl.bufferData(gl.ARRAY_BUFFER, 4*this._vertices.length, this._vertices, gl.STATIC_DRAW);
		gl.bufferData(gl.ARRAY_BUFFER, this._vertices, gl.STATIC_DRAW);

		// Normals
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[1]);
		// gl.bufferData(gl.ARRAY_BUFFER, 4*this._normals.length, this._normals, gl.STATIC_DRAW);
		gl.bufferData(gl.ARRAY_BUFFER, this._normals, gl.STATIC_DRAW);

		// Colors Ids
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[2]);
		// gl.bufferData(gl.ARRAY_BUFFER, 4*this._colorIds.length, this._colorIds, gl.STATIC_DRAW);
		gl.bufferData(gl.ARRAY_BUFFER, this._colorIds.subarray(0), gl.STATIC_DRAW);

		// EBO
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);
		// gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, 4*this._elements.length, this._elements, gl.STATIC_DRAW);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._elements, gl.STATIC_DRAW);

		gl.bindVertexArray(null);
	}

	vertexAttribPointer() {
		gl.bindVertexArray(this._vao[0]);

		// Pointers to attributes
		let positionAttrib = gl.getAttribLocation(this._shaders[0], "aVertexPosition");
		let normalAttrib = gl.getAttribLocation(this._shaders[0], "aVertexNormal");
		let colorAttrib = gl.getAttribLocation(this._shaders[0], "aVertexColorId");

		this._uniformModelMatLoc = gl.getUniformLocation(this._shaders[0], "uModel");
		this._uniformColorTexLoc = gl.getUniformLocation(this._shaders[0], "uColorTable");

		// Vertex position
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[0]);
		gl.enableVertexAttribArray(positionAttrib);
		gl.vertexAttribPointer(positionAttrib, 3, gl.FLOAT, false, 0, 0);

		// Vertex normal data
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[1]);
		gl.enableVertexAttribArray(normalAttrib);
		gl.vertexAttribPointer(normalAttrib, 3, gl.FLOAT, false, 0, 0);

		// Vertex color id data
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[2]);
		gl.enableVertexAttribArray(colorAttrib);
		gl.vertexAttribIPointer(colorAttrib, 1, gl.INT, false, 0, 0);

		// EBO
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);

		// // Unlink VAO
		gl.bindVertexArray(null);
	}

	loadUniform() {
		gl.uniformMatrix4fv(this._uniformModelMatLoc, false, this._modelMat);
		gl.uniform1i(this._uniformColorTexLoc, 0);
	}

	drawSolid() {
		if (!this._draw) { return; }
		this.configGL();
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._hColorTableTexture);

		gl.drawElements(gl.LINE_STRIP, this._elementLength, gl.UNSIGNED_INT, 0);


		this._boundingBox.drawSolid();
	}

	drawTransparent() {}

	cleanOpenGL() {
		gl.deleteBuffer(this._vao[0]);
		gl.deleteBuffer(this._vbo[0]);
		gl.deleteBuffer(this._vbo[1]);
		gl.deleteBuffer(this._vbo[2]);
		gl.deleteBuffer(this._ebo[0]);

		gl.deleteTexture(this._hColorTableTexture);

		this._vao.length = 0;
		this._vbo.length = 0;
		this._ebo.length = 0;

		this._hColorTableTexture = null;
	}

	get fileName() { return this._name; }
	get bundlesNames() { return this._bundlesNames; }

	updateEBO() {
		gl.bindVertexArray(this._vao[0]);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);

		// gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, 4*this._elementLength, this._elements, gl.STATIC_DRAW);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._elements, gl.STATIC_DRAW);

		gl.bindVertexArray(null);
	}

	// createNewEBO() {

	// }

	get selectedBundles() { return this._selectedBundles; }
	set selectedBundles(newSelectedBundles) {
		this._selectedBundles = newSelectedBundles;
		this.createNewEBO;
	}

	get percentage() { return this._fiberPercentage; }
	set percentage(newPercentage) {
		this._fiberPercentage = newPercentage;
		this.createNewEBO();
	}

	static shaderPrograms() {
		let vertexShaderSrcFile = "bundle.vs";
		let fragmentShaderSrcFile = "standardFragmentShader.fs"

		let shaderArray = [shaderProgramFromFiles(vertexShaderSrcFile, fragmentShaderSrcFile)];

		return shaderArray;
	}

	static updateMaterialValues(shaderMap) {
		shaderList = shaderMap.get(typeof(Bundle));

		for (let i=0; i<shaderList.length; i++) {
			gl.useProgram(shaderList[i]);
			glUniform1f(gl.getUniformLocation("uMaterial.Ka"), this._material[0]);
			glUniform1f(gl.getUniformLocation("uMaterial.Kd"), this._material[1]);
			glUniform1f(gl.getUniformLocation("uMaterial.Ks"), this._material[2]);
			glUniform1f(gl.getUniformLocation("uMaterial.shininess"), this._material[3]);
		}
	}

	static get materialKa() { return this._material[0]; }
	static get materialKd() { return this._material[1]; }
	static get materialKs() { return this._material[2]; }
	static get materialShininess() { return this._material[3]; }

	static set materialKa(ka) { this._material[0] = ka; }
	static set materialKd(kd) { this._material[1] = kd; }
	static set materialKs(ks) { this._material[2] = ks; }
	static set materialShininess(shininess) { this._material[3] = shininess; }

	static createProgram() {
		return [createShaderProgram("bundle", "standard-fragment")];
	}
}