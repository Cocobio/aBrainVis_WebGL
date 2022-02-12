class Bundle extends BaseVisualization {
	///// Lighting consts /////
	static 	_material = glMatrix.vec4.fromValues(1.0, 0.8, 0.7, 5.0);

	constructor(intId, shaderMap, file) {
		this._validFileExtensions = new Map([
										['bundles', this._readBundle]//,
										// [ 'tck', this._readTck],
										// [ 'trk', this._readTrk]
										]);

		super.constructor(intId);

		this._type += typeof(this);

		this._curvesCount = 0;
		this._bundlesNames = [];
		this._bundlesStart = [];

		this._vertices = null;
		this._normals = null;
		this._colorIds = null;

		this._elements = null;
		this._fiberSizes = [];

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
		this._shaders = shaderMap.get(this._type);
		this._shaderN = shaders.length; // No hay geometry shader en WebGL 2.0

		// Read and prepare array buffers
		this.readData();
		this.createColorTable();
		this.loadOpenGLData();

		this._draw = true;
		this._drawBB = true;

		this._boundingBox = new BoundingBox(shaderMap, this._dim, this._center);

		console.log("Loading ready "+ this._name +" with "+ this._curvesCount +
			" fibers and "+ this._bundlesNames.length +" bundles.");
	}

	loadOpenGLData() {
		this.updateEBO();
		this.loadColorTexture();
		this.loadGLBuffers();
		this.vertexAttribPointer();

		this._boundingBox.loadOpenGLData();
	}

	readData() {
		let extension = this._name.substring(this._name.lastIndexOf('.')+1);

		if (this._validFileExtensions.has(extension)) {
			this._validFileExtensions.get(extension)();
		}
		else { throw 'Reader for extension not implemented! Extension: '+extension; }
	}

	readBundle() {
		this.readBundleHeader();
		this.readBundleBody();
	}

	readBundleHeader() {
		//////////////////////// 
		/// Patch

		this._bundlesNames.push('0')
		this._curvesCount = 5;
		this._bundlesStart.push(0);
		this._selectedBundles.push(1);
	}

	readBundleBody() {
		//////////////////////// 
		/// Patch
		let staticSize = 5;
		let vertexSize = this._curvesCount*staticSize*3;

		for (let i=0; i<this._curvesCount; i++) {
			this._fiberSizes.push(staticSize);
		}

		this._vertices = new Float32Array(vertexSize);
		this._normals = new Float32Array(vertexSize);
		this._colorIds = new Int16Array(vertexSize/3);

		this._elementLength = vertexSize/3 + this._curvesCount;
		this._elements = new Int16Array(this._elementLength);

		let element = 0;
		let index = 0;
		let primitiveRestartIndex = -1;

		for (let i=0; i<this._curvesCount; i++) {
			for (let j=0; j<staticSize; j++) {
				this._elements[index] = element;
				element ++;
				index ++;
			}

			this._elements[index] = primitiveRestartIndex;
			index ++;
		}
		
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


		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_BORDER);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_BORDER);

		let bgColor = [1.0, 1.0, 1.0, 1.0];
		gl.texParameterfv(gl.TEXTURE_2D, gl.TEXTURE_BORDER_COLOR, new Float32Array(bgColor), 0);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this._bundlesName.length, 1, 0, gl.RGBA, gl.FLOAT, this._colorTable, 0);
	}

	loadGLBuffers() {
		this._vao.push(gl.createVertexArray());

		for (let i=0; i<3; i++) {
			this._vbo.push(gl.createBuffer());
		}
		this._ebo.push(gl.createBuffer());
		
		gl.bindVertexArray(0);

		// VBO
		// Vertex Data
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[0]);
		gl.bufferData(gl.ARRAY_BUFFER, 4*this._vertices.length, this._vertices, gl.STATIC_DRAW);

		// Normals
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[1]);
		gl.bufferData(gl.ARRAY_BUFFER, 4*this._normals.length, this._normals, gl.STATIC_DRAW);

		// Colors Ids
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[3]);
		gl.bufferData(gl.ARRAY_BUFFER, 4*this._colorIds.length, this._colorIds, gl.STATIC_DRAW);

		// EBO
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, 4*this._elements.length, this._elements, gl.STATIC_DRAW);
	}

	vertexAttribPointer() {
		gl.bindVertexArray(this._vao[0]);

		// Pointers to attributes
		let positionAttrib = gl.getAttribLocation(this._shaders[0], "aVertexPosition");
		let normalAttrib = gl.getAttribLocation(this._shaders[0], "aVertexNormal");
		let colorAttrib = gl.getAttribLocation(this._shaders[0], "aVertexColorId");

		this._uniformMMatrixLoc = gl.getUniformLocatino(this._shaders[0], "uModel");
		this._uniformColorTexLoc = gl.getUniformLocation(this._shaders[0], "uColorTable");

		// Vertex position
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[0]);
		gl.enableVertexAttribArray(positionAttrib);
		gl.vertexAttribPointer(positionAttrib, 3, gl.FLOAT, false, 0, 0);

		// Vertex normal data
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo[1]);
		gl.enableVertexAttribArray(normalAttrib);
		gl.vertexAttribPointer(normalAttrib, 3, gl.FLOAT, false, 0, 0);

		// Vertex color id data
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo[2]);
		gl.enableVertexAttribArray(colorAttrib);
		gl.vertexAttribPointer(colorAttrib, 1, gl.INT, false, 0, 0);

		// EBO
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);

		// Unlink VAO
		gl.bindVertexArray(0);
	}

	loadUniform() {
		gl.uniformMatrix4fv(this._uniformMMatrixLoc, 1, false, this._model, 0);
		gl.uniform1i(this._uniformColorTexLoc, 0);
	}

	drawSolid() {
		if (!this._draw) { return; }
		this.configGL();
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._hColorTableTexture);

		gl.drawElements(gl.LINE_STRIP, this._elementLength, gl.UNSIGNED_SHORT, 0);

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

	// updateEBO() {
	// 	gl.bindVertexArray(this._vao[0]);

	// 	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, 4*this._elementLength, this._elements, gl.STATIC_DRAW);

	// 	gl.bindVertexArray(0);
	// }

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
}