/*
@author Ignacio Osorio
*/

class Camera {
	constructor(radius) {
		this._radius = radius;
		this._center = glMatrix.vec3.create();
		this._rotation = glMatrix.quat.create();
		this._viewMat = glMatrix.mat4.create();

		this._eye = glMatrix.vec3.create();
		this._up = glMatrix.vec3.create();

		this.defaultValues();
	}

	defaultValues() {
		glMatrix.quat.identity(this._rotation);

		this._eye[0] = 0;
		this._eye[1] = 0;
		this._eye[2] = 1;

		this._center[0] = 0;
		this._center[1] = 0;
		this._center[2] = 0;

		this._up[0] = 0;
		this._up[1] = 1;
		this._up[2] = 0;

		this.calculateView();
	}

	orbit(dx,dy) {
		let angleMagnitude = Math.sqrt(dx*dx + dy*dy);

		if (angleMagnitude < glMatrix.EPSILON) { return; }

		let x = -dy / angleMagnitude;
		let y = -dx / angleMagnitude;
		let z = 0;

		let newQuat = glMatrix.quat.create();
		glMatrix.quat.setAxisAngle(newQuat, [x,y,z], glMatrix.glMatrix.toRadian(angleMagnitude));
		glMatrix.quat.multiply(this._rotation, this._rotation, newQuat);

		glMatrix.quat.normalize(this._rotation, this._rotation);

		this.calculateView();
	}

	pan(dx, dy) {
		let pan = glMatrix.vec3.fromValues(-dx,dy,0);
		glMatrix.vec3.transformQuat(pan, pan, this._rotation);

		glMatrix.vec3.add(this._center, this._center, pan);

		this.calculateView();
	}

	transverseRotation(angle) {
		if (angle == 0.0) return;

		let newQuat = glMatrix.quat.create();
		glMatrix.quat.setAxisAngle(newQuat, [0,0,1], glMatrix.glMatrix.toRadian(angle));
		glMatrix.quat.multiply(this._rotation, this._rotation, newQuat);

		glMatrix.quat.normalize(this._rotation, this._rotation);

		this.calculateView();
    }

	getAxisAngleFromScreen(outAxis, dx, dy) {
		let angleMagnitude = Math.sqrt(dx*dx + dy*dy);
		quat = glMatrix.quat.create();
		glMatrix.quat.setAxisAngle(quat, [0,0,1], glMatrix.glMatrix.toRadian(90));

		outAxis[0] = dx;
		outAxis[1] = -dy;
		outAxis[2] = 0;

		glMatrix.vec3.transformQuat(outAxis, outAxis, quat);
		glMatrix.vec3.transformQuat(outAxis, outAxis, this._rotation);

		return angleMagnitude;
	}

	getVecFromScreen(outVec, dx, dy) {
		outVec[0] = dx;
		outVec[1] = -dy;
		outVec[2] = 0;

		glMatrix.vec3.transformQuat(outVec, outVec, this._rotation);

		return outVec;
	}

	frontView() {
		glMatrix.quat.identity(this._rotation);
		this.calculateView();
	}


	backView() {
		glMatrix.quat.setAxisAngle(this._rotation, [0,1,0], glMatrix.glMatrix.toRadian(180));
		this.calculateView();
	}


	leftView() {
		glMatrix.quat.setAxisAngle(this._rotation, [0,1,0], glMatrix.glMatrix.toRadian(90));
		this.calculateView();
	}

	rightView() {
		glMatrix.quat.setAxisAngle(this._rotation, [0,-1,0], glMatrix.glMatrix.toRadian(90));
		this.calculateView();
	}


	topView() {
		glMatrix.quat.setAxisAngle(this._rotation, [1,0,0], glMatrix.glMatrix.toRadian(270));
		this.calculateView();
	}


	bottomView() {
		glMatrix.quat.setAxisAngle(this._rotation, [1,0,0], glMatrix.glMatrix.toRadian(90));
		this.calculateView();
	}

	calculateView() {
		let currentEye = glMatrix.vec3.clone(this._eye);
		glMatrix.vec3.scale(currentEye, currentEye, this._radius);

		glMatrix.vec3.transformQuat(currentEye, currentEye, this._rotation);
		glMatrix.vec3.add(currentEye, currentEye, this._center);

		let currentUp = glMatrix.vec3.clone(this._up);
		glMatrix.vec3.transformQuat(currentUp, currentUp, this._rotation);

		glMatrix.mat4.lookAt(this._viewMat, currentEye, this._center, currentUp);
	}


	calculateViewFromValues(outViewMat, eye, center, up, radius, rotation) {
		if (!rotation) { 
			rotation = glMatrix.quat.create();
			glMatrix.quat.identity(rotation);
		}
		let currentEye = glMatrix.vec3.clone(eye);
		glMatrix.vec3.scale(currentEye, currentEye, radius);

		glMatrix.vec3.transformQuat(currentEye, currentEye, rotation);
		glMatrix.vec3.add(currentEye, currentEye, center);

		let currentUp = glMatrix.vec3.clone(up);
		glMatrix.vec3.transformQuat(currentUp, currentUp, rotation);

		glMatrix.mat4.lookAt(outViewMat, currentEye, center, currentUp);
	}


	getEye(outEye) {
		if (!outEye) { outEye = glMatrix.vec3.create(); }
		glMatrix.vec3.copy(outEye, this._eye);
		glMatrix.vec3.scale(outEye, outEye, this._radius);

		glMatrix.vec3.transformQuat(outEye, outEye, this._rotation);
		glMatrix.vec3.add(outEye, outEye, this._center);

		return outEye;
	}

	set radius(r) { this._radius = r; }
	get radius() { return this._radius; }

	get viewMat() { return this._viewMat; }
}