/*---------- ArcBall class implementation*/
function ArcBall(){
    this.AdjustWidth = null
    this.AdjustHeight = null;
    this.StVec = null;
    this.EnVec = null;
    this.Transform = null;
    this.ThisRot = null;
    this.LastRot = null;
    this.Quat = null;
    this.position = [0,0,-1];
    this.lookAt = [0,0,0];
}

ArcBall.prototype = {
    setBounds : function(newWidth, newHeight){
        this.AdjustWidth =  1.0 / ((newWidth  - 1.0) * 0.5);
        this.AdjustHeight = 1.0 / ((newHeight - 1.0) * 0.5);

        this.init();
    },
    
    click : function(X,Y){
        this.StVec = this.mapToSphere(X,Y);
    },

    mapToSphere : function(X,Y){
        var P = {x:0,y:0,z:0}; 

        //Adjust point coords and scale down to range of [-1 ... 1]
        P.x = (X * this.AdjustWidth) - 1.0;
        P.y = 1.0 - (Y * this.AdjustHeight);

        //Compute the square of the length of the vector to the point from the center
        var length = P.x*P.x  + P.y*P.y;

        //If the point is mapped outside of the sphere... (length > radius squared)
        if(length > 1.0){
            //Compute a normalizing factor (radius / sqrt(length))
            var norm = 1.0/Math.sqrt(length);

            //Return the "normalized" vector, a point on the sphere
            P.x *= norm;
            P.y *= norm;
            P.z = 0.0;
            return [P.x,P.y,P.z];
        } else {
            //Return a vector to a point mapped inside the sphere sqrt(radius squared - length)
            return [P.x,P.y,Math.sqrt(1.0-length)];
        }
    },

    drag : function(X,Y){
        this.EnVec = this.mapToSphere(X,Y);

        //Compute the vector perpendicular to the begin and end vectors
        var Perp = cross(this.StVec,this.EnVec);

        //Compute the length of the perpendicular vector
        if(Vector3fLength(Perp) > 1.0e-5){//if its non-zero
            //In the quaternion values, w is cosine (theta / 2), where theta is rotation angle
            var precision = 3;
            return [Perp[0].toFixed(precision)
                ,Perp[1].toFixed(precision)
                ,Perp[2].toFixed(precision),
                dot(this.StVec,this.EnVec).toFixed(precision)];
        } else {
            return [0.0,0.0,0.0,0.0]
        }
    },

    init: function(){
        this.Transform = $M([  [1.0,  0.0,  0.0,  0.0],
                           [0.0,  1.0,  0.0,  0.0],
                           [0.0,  0.0,  1.0,  0.0],
                           [0.0,  0.0,  0.0,  1.0] ]);
         
        this.LastRot   = [  1.0,  0.0,  0.0,                  // Last Rotation
                           0.0,  1.0,  0.0,
                           0.0,  0.0,  1.0 ];
         
        this.ThisRot  = [  1.0,  0.0,  0.0,                  // This Rotation
                           0.0,  1.0,  0.0,
                           0.0,  0.0,  1.0 ];

        this.zoomScale = 1.0;
    },

    slerp: function(keyframe1, keyframe2, t)
    {
        var quat1 = Matrix3fToQuat(keyframe1["rotation"]);
        var quat2 = Matrix3fToQuat(keyframe2["rotation"]);
        var zoom1 = keyframe1["zoom"];
        var zoom2 = keyframe2["zoom"];

        quat1 = $V(quat1);
        quat2 = $V(quat2);
        quat1 = quat1.toUnitVector();
        quat2 = quat2.toUnitVector();

        var dot = quat1.dot(quat2);
        var DOT_THRESHOLD = 0.9995;

        if (Math.abs(dot) > DOT_THRESHOLD)
        {
            var result = quat1 + t * (quat2 - quat1);
            result = result.toUnitVector();
            return result;
        }

        if (dot < 0.0)
        {
            quat2 = quat2.x(-1);
            dot = -dot;
        }

        dot = Math.min(Math.max(dot, -1), 1);
        var theta0 = Math.acos(dot);
        var theta = theta0 * t;

        quat_new = quat2.subtract(quat1.multiply(dot));
        quat_new = quat_new.toUnitVector();

        return [
            quat1.multiply(Math.cos(theta)).add(quat_new.multiply(Math.sin(theta))), 
            zoom1 + t * (zoom2 - zoom1)
        ];
    },

    move: function(X,Y){
       //create a quaternion which captures the rotation of the arcball
        this.Quat = this.drag(X,Y);

       //create a 3x3 matrix of the rotation from the quaternion
        this.ThisRot = Matrix3fSetRotationFromQuat4f(this.Quat);

        //accumulate the current rotation to all previous rotations
        var tmp = ArrayToSylvesterMatrix(this.ThisRot,3)
                    .x(ArrayToSylvesterMatrix(this.LastRot,3))

        //save rotation for next mouse event
        this.ThisRot = SylvesterToArray(tmp);

       //set the final transform matrix that we will multiply by the modelView
       this.Transform = ArrayToSylvesterMatrix(SetRotationMatrixFrom3f(tmp),4);
       this.Transform.elements[3][3] = this.zoomScale;
    },

    getAngles: function(dst_position){
        this.LastRot   = [  1.0,  0.0,  0.0,                  // Last Rotation
                           0.0,  1.0,  0.0,
                           0.0,  0.0,  1.0 ];
        var m = $M(this.Transform);
        m = m.inverse();
        
        src_pos = $V(this.position.elements.slice(0, 3));
        var temp = src_pos.elements;
        var src_mag = Math.sqrt(temp[0] * temp[0] + temp[1] * temp[1] + temp[2] * temp[2]);

        var dst_pos = dst_position;
        temp = dst_pos.elements;
        var dst_mag = Math.sqrt(temp[0] * temp[0] + temp[1] * temp[1] + temp[2] * temp[2]);

        var normalized_src = src_pos.toUnitVector();
        var normalized_dst = dst_pos.toUnitVector();
        normalized_src = Vector.create([normalized_src.elements[0], normalized_src.elements[1], normalized_src.elements[2]]);
        normalized_dst = Vector.create([normalized_dst.elements[0], normalized_dst.elements[1], normalized_dst.elements[2]]);

        //Compute the vector perpendicular to the begin and end vectors
        var Perp = cross(normalized_src.elements, normalized_dst.elements);

        quat = [0.0, 0.0, 0.0, 0.0];
        //Compute the length of the perpendicular vector
        if (Vector3fLength(Perp) > 1.0e-5){//if its non-zero
            //In the quaternion values, w is cosine (theta / 2), where theta is rotation angle
            quat = [Perp[0],Perp[1],Perp[2],dot(normalized_src.elements, normalized_dst.elements)];
        } 
        

        q = {};
        q.x = quat[0];
        q.y = quat[1];
        q.z = quat[2];
        q.w = quat[3];
        w2 = q.w*q.w;
        x2 = q.x*q.x;
        y2 = q.y*q.y;
        z2 = q.z*q.z;
        unitLength = w2 + x2 + y2 + z2;    // Normalised == 1, otherwise correction divisor.
        abcd = q.w*q.x + q.y*q.z;
        eps = 1e-7;    // TODO: pick from your math lib instead of hardcoding.
        pi = Math.PI;   // TODO: pick from your math lib instead of hardcoding.
        if (abcd > (0.5-eps)*unitLength)
        {
            yaw = 2 * Math.atan2(q.y, q.w);
            pitch = pi;
            roll = 0;
        }
        else if (abcd < (-0.5+eps)*unitLength)
        {
            yaw = -2 * Math.atan2(q.y, q.w);
            pitch = -pi;
            roll = 0;
        }
        else
        {
            adbc = q.w*q.z - q.x*q.y;
            acbd = q.w*q.y - q.x*q.z;
            yaw = Math.atan2(2*adbc, 1 - 2*(z2+x2));
            pitch = Math.asin(2*abcd/unitLength);
            roll = Math.atan2(2*acbd, 1 - 2*(y2+x2));
        }

        return {yaw: roll * 180 / Math.PI, pitch: pitch * 180 / Math.PI, roll: yaw * 180 / Math.PI};
    },

    // Rotates to a position (4 element vector)
    rotateTo: function(pos)
    {
        this.LastRot   = [  1.0,  0.0,  0.0,                  // Last Rotation
                           0.0,  1.0,  0.0,
                           0.0,  0.0,  1.0 ];
        var m = $M(this.Transform);
        m = m.inverse();
        var camera_position = $V(this.position.elements.slice(0, 3));//.x(1.0 / this.position.elements[3]);
        var p = camera_position.elements;
        var mag = Math.sqrt(p[0]*p[0] + p[1] * p[1] + p[2] * p[2]);
        p = pos.elements;
        var dst_mag = Math.sqrt(p[0]*p[0] + p[1] * p[1] + p[2] * p[2]);
        var normalized_src = camera_position.toUnitVector();
        var normalized_dst = pos.toUnitVector();
        normalized_src = Vector.create([normalized_src.elements[0], normalized_src.elements[1], normalized_src.elements[2]]);
        normalized_dst = Vector.create([normalized_dst.elements[0], normalized_dst.elements[1], normalized_dst.elements[2]]);
        
        //Compute the vector perpendicular to the begin and end vectors
        var Perp = cross(normalized_src.elements, normalized_dst.elements);

        quat = [0.0, 0.0, 0.0, 0.0];
        //Compute the length of the perpendicular vector
        if (Vector3fLength(Perp) > 1.0e-5){//if its non-zero
            //In the quaternion values, w is cosine (theta / 2), where theta is rotation angle
            quat = [Perp[0],Perp[1],Perp[2],dot(normalized_src.elements, normalized_dst.elements)];
        } 

        this.rotateFromQuaternion(quat, this.LastRot, null);
        return;

        this.ThisRot = Matrix3fSetRotationFromQuat4f(quat);

        //accumulate the current rotation to all previous rotations
        var tmp = ArrayToSylvesterMatrix(this.ThisRot,3)
                    .x(ArrayToSylvesterMatrix(this.LastRot,3))

        //save rotation for next mouse event
        this.ThisRot = SylvesterToArray(tmp);

        //set the final transform matrix that we will multiply by the modelView
        this.Transform = ArrayToSylvesterMatrix(SetRotationMatrixFrom3f(tmp),4);
        //this.Transform.elements[3][3] *= dst_mag;
        this.position.elements[2] = dst_mag;
        this.zoomScale = this.position.elements[2];
    },

    rotateFromQuaternion: function(quat, lastrot, zoom)
    {
        this.LastRot = lastrot;
        this.ThisRot = Matrix3fSetRotationFromQuat4f(quat);

        //accumulate the current rotation to all previous rotations
        var tmp = ArrayToSylvesterMatrix(this.ThisRot,3)
                    .x(ArrayToSylvesterMatrix(this.LastRot,3))

        //save rotation for next mouse event
        this.ThisRot = SylvesterToArray(tmp);

        //set the final transform matrix that we will multiply by the modelView
        this.Transform = ArrayToSylvesterMatrix(SetRotationMatrixFrom3f(tmp),4);
        //this.Transform.elements[3][3] *= dst_mag;
        this.position.elements[2] = zoom == null ? 500 : zoom;
        this.zoomScale = this.position.elements[2];
    
    },
    
    rotateByAngle: function(angle, axis, original_position)
    {
        var oldrot = this.ThisRot;
        this.rotateTo($V(original_position));
        var x = axis == 'x' ? 1 : 0;
        var y = axis == 'y' ? 1 : 0;
        var z = axis == 'z' ? 1 : 0;
        var inRadians = angle * Math.PI / 180.0;
        var rotation = Matrix.Rotation(inRadians, Vector.create([x, y, z])).flatten();
        this.ThisRot = rotation;
        this.LastRot = oldrot;
        var tmp = ArrayToSylvesterMatrix(this.LastRot, 3)
                    .x(ArrayToSylvesterMatrix(this.ThisRot, 3));
        this.ThisRot = SylvesterToArray(tmp);

        this.Transform = this.Transform.x(ArrayToSylvesterMatrix(SetRotationMatrixFrom3f(tmp), 4));
    }
};
/*-------- End ArcBall*/

