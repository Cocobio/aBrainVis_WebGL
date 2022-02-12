/*
@author Ignacio Osorio
*/

class Camera {
	constructor(radius) {
		this.radius = radius;
		this.center = glMatrix.vec3.create();
		this.rotation = glMatrix.quat.create();
		this.viewMat = glMatrix.mat4.create();

		this.eye = glMatrix.vec3.create();
		this.up = glMatrix.vec3.create();

		this.defaultValues();
	}

	defaultValues() {
		glMatrix.quat.identity(this.rotation);

		this.eye[0] = 0;
		this.eye[1] = 0;
		this.eye[2] = 1;

		this.center[0] = 0;
		this.center[1] = 0;
		this.center[2] = 0;

		this.up[0] = 0;
		this.up[1] = 1;
		this.up[2] = 0;

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
		glMatrix.quat.multiply(this.rotation, this.rotation, newQuat);

		glMatrix.quat.normalize(this.rotation, this.rotation);

		this.calculateView();
	}

	panning(dx, dy) {
		let pan = glMatrix.vec3.fromValues(-dx,dy,0);
		glMatrix.vec3.transformQuat(pan, pan, this.rotation);

		glMatrix.vec3.add(this.center, this.center, pan);

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
		glMatrix.vec3.transformQuat(outAxis, outAxis, this.rotation);

		return angleMagnitude;
	}

	getVecFromScreen(outVec, dx, dy) {
		outVec[0] = dx;
		outVec[1] = -dy;
		outVec[2] = 0;

		glMatrix.vec3.transformQuat(outVec, outVec, this.rotation);

		return outVec;
	}

	// public void frontView() {
	// 	Quaternion.setIdentityQ(rotation,0);
	// 	calculateView();
	// }


	// public void backView() {
	// 	Quaternion.fromAngleAndAxis(rotation,0, 180,0,1,0);
	// 	calculateView();
	// }


	// public void leftView() {
	// 	Quaternion.fromAngleAndAxis(rotation,0,90,0,1,0);
	// 	calculateView();
	// }

	// public void rightView() {
	// 	Quaternion.fromAngleAndAxis(rotation,0,90,0,-1,0);
	// 	calculateView();
	// }


	// public void topView() {
	// 	Quaternion.fromAngleAndAxis(rotation,0,270,1,0,0);
	// 	calculateView();
	// }


	// public void bottomView() {
	// 	Quaternion.fromAngleAndAxis(rotation,0,90,1,0,0);
	// 	calculateView();
	// }

	calculateView() {
		let currentEye = glMatrix.vec3.clone(this.eye);
		glMatrix.vec3.scale(currentEye, currentEye, this.radius);

		glMatrix.vec3.transformQuat(currentEye, currentEye, this.rotation);
		glMatrix.vec3.add(currentEye, currentEye, this.center);

		let currentUp = glMatrix.vec3.clone(this.up);
		glMatrix.vec3.transformQuat(currentUp, currentUp, this.rotation);

		glMatrix.mat4.lookAt(this.viewMat, currentEye, this.center, currentUp);
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
		glMatrix.vec3.copy(outEye, this.eye);
		glMatrix.vec3.scale(outEye, outEye, this.radius);

		glMatrix.vec3.transformQuat(outEye, outEye, this.rotation);
		glMatrix.vec3.add(outEye, outEye, this.center);

		return outEye;
	}

	getRadius() {
		return this.radius;
	}
}