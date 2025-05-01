const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const UserSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, "Хэрэглэгчийн кодыг заавал оруулна уу"],
    },
    fname: {
        type: String,
        required: [true, "Хэрэглэгчийн нэрийг оруулна уу"],
    },
    lname: {
        type: String,
        required: [true, "Хэрэглэгчийн овог оруулна уу"],
    },
    email: {
        type: String,
        required: [true, "Хэрэглэгчийн email хаяг оруулна уу"],
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            "Имэйл хаяг буруу байна.",
        ],
        unique: true
    },
    tenhim: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
        required: [true, "Хэрэглэгчийн тэнхим оруулна уу"],
      },
    phonenumber: {
        type: String,
        required: [true, "Утасны дугаараа үнэн зөв оруулж өгнө үү"],
        unique: true
    },
    role: {
        type: String,
        required: [true, "Хэрэглэгчийн эрхийг оруулна уу"],
        enum: ["admin", "bagsh", "oyutan","zochin"],
        default: "zochin",
    },
    password: {
        type: String,
        minlength: 8,
        required: [true, "Нууц үгээ оруулна уу"],
        select: false,
    },
    createdDate: {
        type: Date,
        default: Date.now
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    });
    UserSchema.pre("save", async function (next) {
        // Нууц үг өөрчлөгдөөгүй бол дараачийн middleware рүү шилж
        if (!this.isModified("password")) next();
        // Нууц үг өөрчлөгдсөн
        console.time("salt");
        const salt = await bcrypt.genSalt(10);
        console.timeEnd("salt");
    
        console.time("hash");
        this.password = await bcrypt.hash(this.password, salt);
        console.timeEnd("hash");
    });
    
    UserSchema.methods.getJsonWebToken = function () {
        const token = jwt.sign(
            { id: this._id, role: this.role, code: this.code, email:this.email },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRESIN,
            }
        );
    
        return token;
    };
    
    UserSchema.methods.checkPassword = async function (enteredPassword) {
        return await bcrypt.compare(enteredPassword, this.password);
    };
    
    UserSchema.methods.generatePasswordChangeToken = function () {
        const resetToken = crypto.randomBytes(20).toString("hex");
    
        this.resetPasswordToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");
    
        this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    
        return resetToken;
    };
    
module.exports = mongoose.model("User", UserSchema);