// augment Sylvester some
Matrix.Translation = function (v)
{
  if (v.elements.length == 2) {
    var r = Matrix.I(3);
    r.elements[2][0] = v.elements[0];
    r.elements[2][1] = v.elements[1];
    return r;
  }

  if (v.elements.length == 3) {
    var r = Matrix.I(4);
    r.elements[0][3] = v.elements[0];
    r.elements[1][3] = v.elements[1];
    r.elements[2][3] = v.elements[2];
    return r;
  }

  throw "Invalid length for Translation";
}

Matrix.prototype.flatten = function ()
{
    var result = [];
    if (this.elements.length == 0)
        return [];


    for (var j = 0; j < this.elements[0].length; j++)
        for (var i = 0; i < this.elements.length; i++)
            result.push(this.elements[i][j]);
    return result;
}

Matrix.prototype.ensure4x4 = function()
{
    if (this.elements.length == 4 &&
        this.elements[0].length == 4)
        return this;

    if (this.elements.length > 4 ||
        this.elements[0].length > 4)
        return null;

    for (var i = 0; i < this.elements.length; i++) {
        for (var j = this.elements[i].length; j < 4; j++) {
            if (i == j)
                this.elements[i].push(1);
            else
                this.elements[i].push(0);
        }
    }

    for (var i = this.elements.length; i < 4; i++) {
        if (i == 0)
            this.elements.push([1, 0, 0, 0]);
        else if (i == 1)
            this.elements.push([0, 1, 0, 0]);
        else if (i == 2)
            this.elements.push([0, 0, 1, 0]);
        else if (i == 3)
            this.elements.push([0, 0, 0, 1]);
    }

    return this;
};

Matrix.prototype.make3x3 = function()
{
    if (this.elements.length != 4 ||
        this.elements[0].length != 4)
        return null;

    return Matrix.create([[this.elements[0][0], this.elements[0][1], this.elements[0][2]],
                          [this.elements[1][0], this.elements[1][1], this.elements[1][2]],
                          [this.elements[2][0], this.elements[2][1], this.elements[2][2]]]);
};

Vector.prototype.flatten = function ()
{
    return this.elements;
};

function mht(m) {
    var s = "";
    if (m.length == 16) {
        for (var i = 0; i < 4; i++) {
            s += "<span style='font-family: monospace'>[" + m[i*4+0].toFixed(4) + "," + m[i*4+1].toFixed(4) + "," + m[i*4+2].toFixed(4) + "," + m[i*4+3].toFixed(4) + "]</span><br>";
        }
    } else if (m.length == 9) {
        for (var i = 0; i < 3; i++) {
            s += "<span style='font-family: monospace'>[" + m[i*3+0].toFixed(4) + "," + m[i*3+1].toFixed(4) + "," + m[i*3+2].toFixed(4) + "]</font><br>";
        }
    } else {
        return m.toString();
    }
    return s;
}


//utility functions for arcball/sylvester operations
//

//return vector length
function Vector3fLength(v){
    return Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
}

function Matrix3fToQuat(m)
{
    m = $M(m);
    // m is single dimensional, have to convert it to two dimensional
    m = $M([
            [m.e(1, 1), m.e(2, 1), m.e(3, 1)], 
            [m.e(4, 1), m.e(5, 1), m.e(6, 1)], 
            [m.e(7, 1), m.e(8, 1), m.e(9, 1)]
    ]);
    // elements start from 1 in m.e(...)
    var w = Math.sqrt(1.0 + m.e(1, 1) + m.e(2, 2) + m.e(3, 3)) / 2.0;
    var w4 = 4.0 * w;
    var x = (m.e(3, 2) - m.e(2, 3)) / w4;
    var y = (m.e(1, 3) - m.e(3, 1)) / w4;
    var z = (m.e(2, 1) - m.e(1, 2)) / w4;
    return $V([x, y, z, w]);
}

//create a 3x3 rotation from a quaternion
//adapted from NeHe arcball rotation tutorial
function Matrix3fSetRotationFromQuat4f(q){
    var n,s;
    var xs,ys,zs;
    var wx,wy,wz;
    var xx,xy,xz;
    var yy,yz,zz;

    n = q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3];
    s = (n > 0.0) ? (2.0/n) : 0.0;

    xs = q[0] * s; ys = q[1] * s; zs = q[2] * s;
    wx = q[3] * xs; wy = q[3] * ys; wz = q[3] * zs;
    xx = q[0] * xs; xy = q[0] * ys; xz = q[0] * zs;
    yy = q[1] * ys; yz = q[1] * zs; zz = q[2] * zs;

    var rot = [];

    rot[0] = 1.0 - (yy + zz); rot[1] = xy - wz; rot[2] = xz + wy;
    rot[3] = xy + wz; rot[4] = 1.0 - (xx + zz); rot[5] = yz - wx;
    rot[6] = xz - wy; rot[7] = yz + wx; rot[8] = 1.0 - (xx + yy);

    return rot;
}

//create a sylvester matrix from a flat array
function ArrayToSylvesterMatrix(m,size){
    var M = [];
    var tmp;
    for(var i = 0; i < size; i++){
        tmp = [];
        for(var j = 0; j < size; j++){
            tmp.push(m[i*size+j]);
        }
        M.push(tmp);
    }
    return $M(M);
};

//create a flat array from a sylvester matrix
function SylvesterToArray(M){
    var m = [];
    for(var i = 0; i < M.elements.length; i++){
        for(var j = 0; j < M.elements[i].length; j++){
            m.push(M.elements[i][j]);
        }
    }
    return m;
}

//create a 4x4 rotation matrix as a flat array from a 3x3 sylvester matrix
function SetRotationMatrixFrom3f(M){
    var m = SylvesterToArray(M);
    if(m.length != 9){
        console.log("SetRotationMatrixFrom3f requires 9 number array");
        return;
    }

    var R = [];
    R[0] = m[0]; R[1] = m[1]; R[2] = m[2]; R[3] = 0;
    R[4] = m[3]; R[5] = m[4]; R[6] = m[5]; R[7] = 0;
    R[8] = m[6]; R[9] = m[7]; R[10] = m[8]; R[11] = 0;
    R[12] = 0;   R[13] = 0;   R[14] = 0;    R[15] = 1;

    return R;
}

//perform dot product on two arbitrary length arrays
function dot(a,b){
    var la = a.length;
    var lb = b.length;
    if(la != lb){
        console.log("dot product vectors not same length");
        return null;
    }
    var result = 0.0;
    for(var i = 0; i < lb; i++){
        result += a[i]*b[i];
    }
    return result;
}

//perform cross product on two 3 element vectors
function cross(v1, v2) {
  var vR = [0.0,0.0,0.0];
  vR[0] =   ( (v1[1] * v2[2]) - (v1[2] * v2[1]) );
  vR[1] = - ( (v1[0] * v2[2]) - (v1[2] * v2[0]) );
  vR[2] =   ( (v1[0] * v2[1]) - (v1[1] * v2[0]) );
  return vR;
}
