class Bundle extends BaseVisualization {
	///// Lighting consts /////
	static 	_material = glMatrix.vec4.fromValues(1.0, 0.8, 0.7, 5.0);
	static _validFileExtensions = new Map([
										['bundles', "_readBundle"],
										['bundlesdata', ""],			// Only for setup of file loader
										[ 'tck', "_readTck"],
										[ 'trk', "_readTrk"],
										[ 'json', ""]					// Only for setups of file loader... Will contain metadata
										]);
	static _validMetadata = new Map([
										['colors', "createColorTableFromDict"]
										]);
	static _type = Bundle.name;

	constructor(intId, file) {
		super(intId);


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
		// Resources (server) file
		if (typeof(file)==='string') {
			this._path = file;
			this._name = file.substring(file.lastIndexOf('/')+1, file.lastIndexOf('.'));
			this._extension = this._path.substring(this._path.lastIndexOf('.')+1,this._path.length);
		// Local machine file
		} else {
			this._path = file[0];
			this._name = file[1].substring(0,file[1].lastIndexOf('.'));
			this._extension = file[1].substring(file[1].lastIndexOf('.')+1);
		}


		// Shaders info
		// this._shaders = shaderMap[this._type];
		// this._shaderN = this._shaders.length; // No hay geometry shader en WebGL 2.0

		this._boundingBox = new BoundingBox([0,0,0], [0,0,0]);

		// Read and prepare array buffers
		this.finishingTouchesCallback = undefined;
		this.finishingTouches();
	}

	async finishingTouches() {
		await this.readData();
		this.createRandomColorTable();
		this.loadOpenGLData();

		this._boundingBox.updateBBModel(this._dim, this._center);

		if (this.finishingTouchesCallback != undefined) {
			this.finishingTouchesCallback();
			this.finishingTouchesCallback = undefined;
		}

		console.log("Loading ready "+ this._name +" with "+ this._curvesCount +
			" fibers and "+ this._bundlesNames.length +" bundles.");
		
		this._draw = true;
	}

	loadOpenGLData() {
		this.createColorTexture();
		this.loadColorTexture();
		this.loadGLBuffers();
		this.vertexAttribPointer();
		this.updateEBO();

		this._boundingBox.loadOpenGLData();
	}

	async readData() {
		if (Bundle._validFileExtensions.has(this._extension)) {
			await this[Bundle._validFileExtensions.get(this._extension)]();
		}
		else { throw 'Reader for extension not implemented! Extension: '+this._extension; }
	}

	async _readBundle() {
		await this.readBundleHeader();
		await this.readBundleBody();
	}

	// Based in https://mrtrix.readthedocs.io/en/latest/getting_started/image_data.html?highlight=format#tracks-file-format-tck
	// and https://github.com/scilus/fibernavigator/blob/master/src/dataset/Fibers.cpp
	async _readTck() {
		let buffer;
		if (typeof(this._path)==='string') {
			buffer = await loadFile(this._path, 'arrayBuffer');
		} else {
			buffer = await loadFile(this._path[0], 'arrayBuffer');
		}

		let headerBuffer=0;
		let offset = 0;
		let jump = 1000;

		let headerSize;
		let fileSize = buffer.byteLength;
		let flagCounts = false, flagHeaderSize = false;

		do {
			headerBuffer = String.fromCharCode.apply(null, new Uint8Array(buffer,offset,jump));
			offset += jump;

			if (headerBuffer.indexOf("file:") != -1) {
				headerSize = parseInt(headerBuffer.substring(headerBuffer.indexOf("file: .")+7));
				flagHeaderSize = true;
			}

			if (headerBuffer.indexOf("count:") != -1) {
				this._curvesCount = parseInt(headerBuffer.substring(headerBuffer.indexOf("count:")+6));;
				flagCounts = true;
			}

		} while (headerBuffer.indexOf("END") == -1);

		if (!flagCounts && !flagHeaderSize) { throw "Missing count of fibers or header size of Tck."; }

		this._bundlesNames.push(this._name);
		this._selectedBundles.push(true);
		this._bundlesStart.push(0);
		this._bundlesStart.push(this._curvesCount);

		let dataSize = (fileSize-headerSize-12-12*this._curvesCount)/4;

		// Create buffers
		this._vertices = new Float32Array(dataSize);
		this._normals = new Float32Array(dataSize);

		// Using STRIP_LINE and PrimitiveRestart
		if (aBrainGL.contextType == "webgl2") {
			this._colorIds = new Int32Array((dataSize)/3);
			this._elements = new Uint32Array((dataSize)/3+this._curvesCount);
		// Using only LINES
		} else {
			this._colorIds = new Float32Array((dataSize)/3);
			this._elements = new Uint32Array(((dataSize)/3-this._curvesCount)*2);
		}
		this._elementLength = this._elements.length;

		// Read the buffers
		let data = buffer.slice(headerSize);
		let bufferFloatView = new Float32Array(data);

		let elementsIndex = 0;
		let index = 0;
		let normal = [1.0, 1.0, 1.0];
		let norma = 1.0;
		let bufferIndex = 0;
		let primitiveRestartIndex = 0xFFFFFFFF;

		let xmin = Infinity, xmax = -Infinity;
		let ymin = Infinity, ymax = -Infinity;
		let zmin = Infinity, zmax = -Infinity;

		this._fiberSizes = new Array(this._curvesCount);
		let tempVertex = new Float32Array(3);

		for (let i=0; i<this._curvesCount; i++) {

			for(this._fiberSizes[i] = 0; !isNaN(bufferFloatView[bufferIndex]); bufferIndex += 3) {
				this._vertices.set(bufferFloatView.subarray(bufferIndex,bufferIndex+3), (index+this._fiberSizes[i])*3);
				this._fiberSizes[i]++;
			}
			bufferIndex += 3;

			this._elements[elementsIndex++] = primitiveRestartIndex;

			for (let k=0; k<this._fiberSizes[i]-1; k++) {
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
				this._colorIds[index] = 0;

				this._elements[elementsIndex++] = index++;
			}

			if (this._vertices[index*3]<xmin) { xmin = this._vertices[index*3]; }
			else if (this._vertices[index*3]>xmax) { xmax = this._vertices[index*3]; }

			if (this._vertices[index*3+1]<ymin) { ymin = this._vertices[index*3+1]; }
			else if (this._vertices[index*3+1]>ymax) { ymax = this._vertices[index*3+1]; }

			if (this._vertices[index*3+2]<zmin) { zmin = this._vertices[index*3+2]; }
			else if (this._vertices[index*3+2]>zmax) { zmax = this._vertices[index*3+2]; }

			this._normals.set(normal,index*3);
			this._colorIds[index] = 0;

			this._elements[elementsIndex++] = index++;
			this._elements[elementsIndex++] = primitiveRestartIndex;
		}


		this._dim[0] = (xmax-xmin);
		this._dim[1] = (ymax-ymin);
		this._dim[2] = (zmax-zmin);

		this._center[0] = xmin + this._dim[0]/2;
		this._center[1] = ymin + this._dim[1]/2;
		this._center[2] = zmin + this._dim[2]/2;

		if (aBrainGL.contextType != "webgl2") { this.createWebGL1EBO(); }
	}

	/// based in http://www.trackvis.org/docs/?subsect=fileformat
	async _readTrk() {
		let buffer;
		if (typeof(this._path)==='string') {
			buffer = await loadFile(this._path, 'arrayBuffer');
		} else {
			buffer = await loadFile(this._path[0], 'arrayBuffer');
		}

		let header = parseTrkHeader(buffer);

		if (!header.id_string.startsWith("TRACK")) { alert("Files %s is not a Track file.", this._name); throw "Trk file not a Track."; }

		this._curvesCount = header.n_count;
		this._bundlesNames.push(this._name);
		this._selectedBundles.push(true);
		this._bundlesStart.push(0);
		this._bundlesStart.push(this._curvesCount);

		let dataSize = ((buffer.byteLength-header.hdr_size)/4-this._curvesCount*(header.n_properties+1))*3/(3+header.n_scalars);

		// Create buffers
		this._vertices = new Float32Array(dataSize);
		this._normals = new Float32Array(dataSize);

		// Using STRIP_LINE and PrimitiveRestart
		if (aBrainGL.contextType == "webgl2") {
			this._colorIds = new Int32Array((dataSize)/3);
			this._elements = new Uint32Array((dataSize)/3+this._curvesCount);
		// Using only LINES
		} else {
			this._colorIds = new Float32Array((dataSize)/3);
			this._elements = new Uint32Array(((dataSize)/3-this._curvesCount)*2);
		}
		this._elementLength = this._elements.length;

		// Read the buffers
		let bufferFloatView = new Float32Array(buffer, header.hdr_size);
		let bufferIntView = new Int32Array(buffer, header.hdr_size);

		let elementsIndex = 0;
		let index = 0;
		let normal = [1.0, 1.0, 1.0];
		let norma = 1.0;
		let bufferIndex = 0;
		let primitiveRestartIndex = 0xFFFFFFFF;
		let i;

		let xmin = Infinity, xmax = -Infinity;
		let ymin = Infinity, ymax = -Infinity;
		let zmin = Infinity, zmax = -Infinity;

		this._fiberSizes = new Array(this._curvesCount);
		let tempVertex = new Float32Array(3);

		let scalars;
		if (header.n_scalars != 0) { scalars = new Float32Array(dataSize/3*header.n_scalars); }

		let properties;
		if (header.n_properties != 0) { properties = new Float32Array(this._curvesCount*header.n_scalars); }


		//////////////////////////
		let readPoints = (currentSize) => { 
			this._vertices.set(bufferFloatView.subarray(bufferIndex,bufferIndex+currentSize*3), index*3);
			bufferIndex += 3*currentSize;
		};

		let readPointsScalars = (currentSize) => {
			for(j=0; j<currentSize; j++) {
				this._vertices.set(bufferFloatView.subarray(bufferIndex,bufferIndex+3), (index+j)*3);
				bufferIndex += 3;
				scalars.set(bufferFloatView.subarray(bufferIndex,bufferIndex+header.n_scalars), (index+j)*header.n_scalars);
				bufferIndex += header.n_scalars;
			}
		};

		let readPointsProperties = (currentSize) => {
			this._vertices.set(bufferFloatView.subarray(bufferIndex,bufferIndex+currentSize*3), index*3);
			bufferIndex += 3*currentSize;
			properties.set(bufferFloatView.subarray(bufferIndex,bufferIndex+header.n_properties), i*header.n_properties);
			bufferIndex += header.n_properties;
		};

		let readPointsScalarsProperties = (currentSize) => {
			for(j=0; j<currentSize; j++) {
				this._vertices.set(bufferFloatView.subarray(bufferIndex,bufferIndex+3), (index+j)*3);
				bufferIndex += 3;
				scalars.set(bufferFloatView.subarray(bufferIndex,bufferIndex+header.n_scalars), (index+j)*header.n_scalars);
				bufferIndex += header.n_scalars;
			}
			properties.set(bufferFloatView.subarray(bufferIndex,bufferIndex+header.n_properties), i*header.n_properties);
			bufferIndex += header.n_properties;
		};

		let readData_i;

		if (header.n_scalars == 0 && header.n_properties == 0) {
			readData_i = readPoints;
		}
		else if (header.n_scalars != 0 && header.n_properties == 0) {
			readData_i = readPointsScalars;
		}
		else if (header.n_scalars == 0 && header.n_properties != 0) {
			readData_i = readPointsProperties;
		}
		else {
			readData_i = readPointsScalarsProperties;
		}

		for (i=0; i<this._curvesCount; i++) {
			this._fiberSizes[i] = bufferIntView[bufferIndex++];
			readData_i(this._fiberSizes[i]);

			for (let k=0; k<this._fiberSizes[i]-1; k++) {
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
				this._colorIds[index] = 0;

				this._elements[elementsIndex++] = index++;
			}

			if (this._vertices[index*3]<xmin) { xmin = this._vertices[index*3]; }
			else if (this._vertices[index*3]>xmax) { xmax = this._vertices[index*3]; }

			if (this._vertices[index*3+1]<ymin) { ymin = this._vertices[index*3+1]; }
			else if (this._vertices[index*3+1]>ymax) { ymax = this._vertices[index*3+1]; }

			if (this._vertices[index*3+2]<zmin) { zmin = this._vertices[index*3+2]; }
			else if (this._vertices[index*3+2]>zmax) { zmax = this._vertices[index*3+2]; }

			this._normals.set(normal,index*3);
			this._colorIds[index] = 0;

			this._elements[elementsIndex++] = index++;
			this._elements[elementsIndex++] = primitiveRestartIndex;
		}	

		this._dim[0] = (xmax-xmin);
		this._dim[1] = (ymax-ymin);
		this._dim[2] = (zmax-zmin);

		this._center[0] = xmin + this._dim[0]/2;
		this._center[1] = ymin + this._dim[1]/2;
		this._center[2] = zmin + this._dim[2]/2;

		let inverseVoxelSize = glMatrix.mat4.create();
		glMatrix.mat4.fromScaling(inverseVoxelSize, [1/header.voxel_size[0], 1/header.voxel_size[1], 1/header.voxel_size[2]])
		let trkMat = glMatrix.mat4.create();
		glMatrix.mat4.multiply(trkMat, header.vox_to_ras, inverseVoxelSize);
		let halfVoxelSize = glMatrix.mat4.create();
		glMatrix.mat4.fromTranslation(halfVoxelSize, [-header.voxel_size[0]/2, -header.voxel_size[1]/2, -header.voxel_size[2]/2])
		glMatrix.mat4.multiply(trkMat, trkMat, halfVoxelSize);

		this._affine = glMatrix.mat4.clone(trkMat);
		glMatrix.mat4.copy(this._modelMat, this._affine);
		glMatrix.mat4.invert(this._inverseModelMat, this._modelMat);
		this.recalculateNormals();
		this.recaulculateDimCenter();

		if (aBrainGL.contextType != "webgl2") { this.createWebGL1EBO(); }
	}

	calculateModel() {
		// Only with Trk files
		if (this._affine) { glMatrix.mat4.copy(this._modelMat, this._affine); }
		else { glMatrix.mat4.identity(this._modelMat); }
		glMatrix.mat4.multiply(this._modelMat, this._rotationMat, this._scaleMat);
		glMatrix.mat4.multiply(this._modelMat, this._modelMat, this._translateMat);

		glMatrix.mat4.invert(this._inverseModelMat, this._modelMat);
	}

	resetModelMat() {
		// Only with Trk files
		if (this._affine) {
			glMatrix.mat4.copy(this._modelMat, this._affine);
			glMatrix.mat4.invert(this._inverseModelMat, this._modelMat);
		}
		else { 
			glMatrix.mat4.identity(this._modelMat);
			glMatrix.mat4.identity(this._inverseModelMat);
		}

		glMatrix.mat4.identity(this._rotationMat);
		glMatrix.mat4.identity(this._translateMat);
		glMatrix.mat4.identity(this._scaleMat);
	}

	recalculateNormals() {
		let normal = new Array(3);
		let norma = 1.0;
		let offset = 0;

		for (let i=0; i<this._curvesCount; i++) {
			for (let j=0; j<this._fiberSizes[i]-1; j++) {
				normal[0] = this._vertices[offset+j*3+3] - this._vertices[offset+ j*3 ];
				normal[1] = this._vertices[offset+j*3+4] - this._vertices[offset+j*3+1];
				normal[2] = this._vertices[offset+j*3+5] - this._vertices[offset+j*3+2];

				norma = Math.sqrt(normal[0]*normal[0] + normal[1]*normal[1] + normal[2]*normal[2]);

				this._normals[offset+ j*3 ] = normal[0]/norma;
				this._normals[offset+j*3+1] = normal[1]/norma;
				this._normals[offset+j*3+2] = normal[2]/norma;
			}

			this._normals[offset+this._fiberSizes[i]*3-3] = normal[0]/norma;
			this._normals[offset+this._fiberSizes[i]*3-2] = normal[1]/norma;
			this._normals[offset+this._fiberSizes[i]*3-1] = normal[2]/norma;
			offset += this._fiberSizes[i]*3;
		}
	}

	recaulculateDimCenter() {
		let xmin = Infinity, xmax = -Infinity;
		let ymin = Infinity, ymax = -Infinity;
		let zmin = Infinity, zmax = -Infinity;

		let offset = 0;

		let tempVertex = glMatrix.vec4.create();

		let tmpMat4 = glMatrix.mat4.create();
		if (this._affine) { glMatrix.mat4.copy(tmpMat4, this._affine); }
		else { glMatrix.mat4.identity(tmpMat4); }

		for (let i=0; i<this._curvesCount; i++) {
			for (let k=0; k<this._fiberSizes[i]; k++) {
				glMatrix.vec3.transformMat4(tempVertex, this._vertices.subarray((offset+k)*3,(offset+k)*3+3), tmpMat4);

				if (tempVertex[0]<xmin) { xmin = tempVertex[0]; }
				else if (tempVertex[0]>xmax) { xmax = tempVertex[0]; }

				if (tempVertex[1]<ymin) { ymin = tempVertex[1]; }
				else if (tempVertex[1]>ymax) { ymax = tempVertex[1]; }

				if (tempVertex[2]<zmin) { zmin = tempVertex[2]; }
				else if (tempVertex[2]>zmax) { zmax = tempVertex[2]; }
			}
			offset += this._fiberSizes[i];
		}	

		this._dim[0] = (xmax-xmin);
		this._dim[1] = (ymax-ymin);
		this._dim[2] = (zmax-zmin);

		this._center[0] = xmin + this._dim[0]/2;
		this._center[1] = ymin + this._dim[1]/2;
		this._center[2] = zmin + this._dim[2]/2;
	}

	async readBundleHeader() {
		let data;
		if (typeof(this._path)==='string') {
			data = await loadFile(this._path,'text');
		} else {
			data = await loadFile(this._path[0],'text');
		}
		// let headerDict = parsePythonDict(data);
		let json = data.substring(13).replace(/\'/g, "\"");
		let headerDict = JSON.parse(json);

		this._curvesCount = headerDict.curves_count;

		for (let i=0; i<headerDict.bundles.length; i+=2) {
			this._bundlesNames.push(headerDict.bundles[i]);
			this._bundlesStart.push(headerDict.bundles[i+1]);
			this._selectedBundles.push(true);
		}

		this._bundlesStart.push(this._curvesCount);
	}


	async readBundleBody() {
		let buffer;
		if (typeof(this._path)==='string') {
			buffer = await loadFile(this._path+"data", 'arrayBuffer');
		} else {
			buffer = await loadFile(this._path[1], 'arrayBuffer');
		}
		let bufferIntView = new Int32Array(buffer);
		let bufferFloatView = new Float32Array(buffer);

		let dataSize = buffer.byteLength;

		this._vertices = new Float32Array(dataSize/4-this._curvesCount);
		this._normals = new Float32Array(dataSize/4-this._curvesCount);

		// Using STRIP_LINE and PrimitiveRestart
		if (aBrainGL.contextType == "webgl2") {
			this._colorIds = new Int32Array((dataSize/4-this._curvesCount)/3);
			this._elements = new Uint32Array((dataSize/4-this._curvesCount)/3+this._curvesCount);
		// Using only LINES
		} else {
			this._colorIds = new Float32Array((dataSize/4-this._curvesCount)/3);
			this._elements = new Uint32Array(((dataSize/4-this._curvesCount)/3-this._curvesCount)*2);
		}
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

		if (aBrainGL.contextType != "webgl2") { this.createWebGL1EBO(); }
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

	static get validFileExtension() {
		return this._validFileExtensions;
	}

	createRandomColorTable() {
		////////// Y si utilizo otro que no sea Float32Array?
		if (this._colorTable == null)
			this._colorTable = new Float32Array(this._bundlesNames.length*4);

		for (let i=0; i<this._bundlesNames.length; i++) {
			this._colorTable[ i*4 ] = Math.random()*0.7 + 0.3;
			this._colorTable[i*4+1] = Math.random()*0.7 + 0.3;
			this._colorTable[i*4+2] = Math.random()*0.7 + 0.3;
			this._colorTable[i*4+3] = 1.0;
		}
	}

	createColorTableFromDict(dict) {
		for (const [name, color] of Object.entries(dict)) {
			let idx = this._bundlesNames.findIndex( element => element==name);

			if (idx != -1) {
				this._colorTable[ idx*4 ] = color[0]/255.0;
				this._colorTable[idx*4+1] = color[1]/255.0;
				this._colorTable[idx*4+2] = color[2]/255.0;
			}
		}

		this.updateColorTextures();
	}

	createColorTexture() {
		this._hColorTableTexture = gl.createTexture();

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._hColorTableTexture);


		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	}

	loadColorTexture() {
		if (aBrainGL.contextType == "webgl2") {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this._bundlesNames.length, 1, 0, gl.RGBA, gl.FLOAT, this._colorTable, 0);
		} else {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this._bundlesNames.length, 1, 0, gl.RGBA, gl.FLOAT, this._colorTable, 0);
		}
	}

	updateColorTextures() {
		for (let i=0; i<Bundle._shaders.length; i++) {
			gl.useProgram(Bundle._shaders[i]);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this._hColorTableTexture);
			this.loadColorTexture();
		}
	}

	shuffleColors() {
		this.createRandomColorTable();
		this.updateColorTextures();
	}

	loadGLBuffers() {
		if (aBrainGL.contextType == "webgl2") {
			this._vao.push(gl.createVertexArray());
			gl.bindVertexArray(this._vao[0]);
		}

		for (let i=0; i<3; i++) {
			this._vbo.push(gl.createBuffer());
		}
		this._ebo.push(gl.createBuffer());
		

		// VBO
		// Vertex Data
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[0]);
		gl.bufferData(gl.ARRAY_BUFFER, this._vertices, gl.STATIC_DRAW);

		// Normals
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[1]);
		gl.bufferData(gl.ARRAY_BUFFER, this._normals, gl.STATIC_DRAW);

		// Colors Ids
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[2]);
		gl.bufferData(gl.ARRAY_BUFFER, this._colorIds.subarray(0), gl.STATIC_DRAW);

		// EBO
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._elements, gl.STATIC_DRAW);
	}

	vertexAttribPointer() {
		// Pointers to attributes
		this._positionAttributeLoc = gl.getAttribLocation(Bundle._shaders[0], "aVertexPosition");
		this._normalAttributeLoc = gl.getAttribLocation(Bundle._shaders[0], "aVertexNormal");
		this._colorAttributeLoc = gl.getAttribLocation(Bundle._shaders[0], "aVertexColorId");

		this._uniformModelMatLoc = gl.getUniformLocation(Bundle._shaders[0], "uModel");
		this._uniformColorTexLoc = gl.getUniformLocation(Bundle._shaders[0], "uColorTable");

		// Only with webgl1 value will matter
		this._uniformTextureLengthLoc = gl.getUniformLocation(Bundle._shaders[0], "uTextureLength");

		// Vertex position
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[0]);
		gl.enableVertexAttribArray(this._positionAttributeLoc);
		gl.vertexAttribPointer(this._positionAttributeLoc, 3, gl.FLOAT, false, 0, 0);

		// Vertex normal data
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[1]);
		gl.enableVertexAttribArray(this._normalAttributeLoc);
		gl.vertexAttribPointer(this._normalAttributeLoc, 3, gl.FLOAT, false, 0, 0);

		// Vertex color id data
		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[2]);
		gl.enableVertexAttribArray(this._colorAttributeLoc);
		if (aBrainGL.contextType == "webgl2") {
			gl.vertexAttribIPointer(this._colorAttributeLoc, 1, gl.INT, false, 0, 0);
		} else {
			gl.vertexAttribPointer(this._colorAttributeLoc, 1, gl.FLOAT, false, 0, 0);
		}

		// EBO
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);

		// unbind vao
		if (aBrainGL.contextType == "webgl2") {
			gl.bindVertexArray(null);
		}
	}

	bindBufferAttribPointers() {

		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[0]);
		gl.vertexAttribPointer(this._positionAttributeLoc, 3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[1]);
		gl.vertexAttribPointer(this._normalAttributeLoc, 3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo[2]);
		gl.vertexAttribPointer(this._colorAttributeLoc, 1, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._hColorTableTexture);
	}

	loadUniform() {
		gl.uniformMatrix4fv(this._uniformModelMatLoc, false, this._modelMat);
		gl.uniform1i(this._uniformColorTexLoc, 0);
	}

	configWebGL1() {
		super.configWebGL1();
		gl.uniform1f(this._uniformTextureLengthLoc, this._bundlesNames.length);
	}

	async loadMetaData(jsonFileUrl) {
		let metadata = await loadFile(jsonFileUrl, 'json');

		for (const [key, value] of Object.entries(metadata)) {
			if (Bundle._validMetadata.has(key)) 
				this[Bundle._validMetadata.get(key)](value);
		}
	}

	drawSolid() {
		if (!this._draw) { return; }
		this.configGL();
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._hColorTableTexture);

		gl.drawElements(gl.LINE_STRIP, this._elementLength, gl.UNSIGNED_INT, 0);

		// unbind vao
		gl.bindVertexArray(null);

		this._boundingBox.drawSolid();
	}

	drawSolid_WebGL1() {
		if (!this._draw) { return; }
		this.configGL();
		
		gl.drawElements(gl.LINES, this._elementLength, gl.UNSIGNED_INT, 0);

		this._boundingBox.drawSolid();
	}

	drawTransparent() {}

	cleanOpenGL() {
		try {
			if (aBrainGL.contextType == "webgl2") {
				gl.deleteBuffer(this._vao[0]);
			}
			gl.deleteBuffer(this._vbo[0]);
			gl.deleteBuffer(this._vbo[1]);
			gl.deleteBuffer(this._vbo[2]);
			gl.deleteBuffer(this._ebo[0]);

			gl.deleteTexture(this._hColorTableTexture);
		} catch(error) { console.log(error); };
		
		this._vao.length = 0;
		this._vbo.length = 0;
		this._ebo.length = 0;

		this._hColorTableTexture = null;

		this._boundingBox.cleanOpenGL();
	}

	get fileName() { return this._name; }
	get filePath() { return this._path; }
	get bundlesNames() { return this._bundlesNames; }

	updateEBO() {
		if (aBrainGL.contextType == "webgl2") {
			gl.bindVertexArray(this._vao[0]);
		}
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ebo[0]);

		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._elements, gl.STATIC_DRAW);

		// unbind vao
		if (aBrainGL.contextType == "webgl2") {
			gl.bindVertexArray(null);
		}
	}

	createWebGL1EBO() {
		let e = 0;
		let elementCurrentIdx = 0;

		for (let i=0; i<this._bundlesStart.length-1; i++) {
			for (let j=this._bundlesStart[i]; j<this._bundlesStart[i+1]; j++) {
				for (let k=0; k<this._fiberSizes[j]-1; k++) {
					this._elements[elementCurrentIdx++] = e++;
					this._elements[elementCurrentIdx++] = e;
				}
				e++;
			}
		}
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

	static updateMaterialValues() {
		for (let i=0; i<this._shaders.length; i++) {
			gl.useProgram(this._shaders[i]);
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
		if (aBrainGL.contextType == 'webgl2') {
			return [createShaderProgram("bundle", "standard-fragment")];
		} else {
			return [createShaderProgram("bundle-webgl1", "standard-fragment-webgl1")];
		}
	}
}