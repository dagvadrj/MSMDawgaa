const User = require("../models/users");
const MyError = require("../utils/myError");
const asyncHandler = require("express-async-handler");
const paginate = require("../utils/paginate");
const sendEmail = require("../utils/email");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

// Хэрэглэгч бүртгүүлэх
exports.register = asyncHandler(async (req, res, next) => {
    const { password,password1 } = req.body;
    if (password1 !== password) {
        throw new MyError("Нууц үгийн давталт буруу байна. Шалгаарай!!!", 400);
    }
    const user = await User.create(req.body);
    
    const token = user.getJsonWebToken();

    res.status(200).json({
        success: true,
        token,
        user: user
    });
});

// логин хийнэ
exports.login = asyncHandler(async (req, res, next) => {
    const { uname, password } = req.body;

    // Оролтыгоо шалгана

    if (!uname || !password) {
        throw new MyError("Хэрэглэгчийн нэр болон нууц үйгээ дамжуулна уу", 400);
    }

    // Тухайн хэрэглэгчийн хайна
    const useremail = await User.findOne({ email: uname}).select("+password");
    const usercode = await User.findOne({ code: uname}).select("+password");
    
    const user = (useremail!=null ? useremail : usercode)
    if (!user) {
        throw new MyError("Хэрэглэгчийн нэрээ зөв оруулна уу", 401);
    }

    const ok = await user.checkPassword(password);

    if (!ok) {
        throw new MyError("Нууц үгээ зөв оруулна уу", 401);
    }

    const token = user.getJsonWebToken();

    const cookieOption = {
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        httpOnly: true,
    };

    res.status(200).cookie("user-token", token, cookieOption).json({
        success: true,
        token,
        user: user,
    });
});

exports.logout = asyncHandler(async (req, res, next) => {
    const cookieOption = {
        expires: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        httpOnly: true,
    };

    res.status(200).cookie("user-token", null, cookieOption).json({
        success: true,
        result: "logged out...",
    });
});

exports.getUsers = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort;
    const select = req.query.select;

    ["select", "sort", "page", "limit"].forEach((el) => delete req.query[el]);

    const pagination = await paginate(page, limit, User);

    const users = await User.find(req.query, select)
        .sort(sort)
        .skip(pagination.start - 1)
        .limit(limit);

    res.status(200).json({
        success: true,
        result: users,
        pagination,
    });
});

exports.getUser = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        throw new MyError(req.params.id + " ID-тэй хэрэглэгч байхгүй!", 400);
    }

    res.status(200).json({
        success: true,
        result: user
    });
});

exports.createUser = asyncHandler(async (req, res, next) => {
    const user = await User.create(req.body);
    res.status(200).json({
        success: true,
        result: user
    });
});

exports.updateUser = asyncHandler(async (req, res, next) => {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!user) {
        throw new MyError(req.params.id + " ID-тэй хэрэглэгч байхгүйээээ.", 400);
    }

    res.status(200).json({
        success: true,
        result: user,
    });
});

exports.deleteUser = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.id);

    if (!user) {
        throw new MyError(req.params.id + " ID-тэй хэрэглэгч байхгүйээээ.", 400);
    }

    user.remove();

    res.status(200).json({
        success: true,
        result: user,
    });
});

exports.forgotPassword = asyncHandler(async (req, res, next) => {
    if (!req.body.email) {
        throw new MyError("Та нууц үг сэргээх имэйл хаягаа дамжуулна уу", 400);
    }

    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        throw new MyError(req.body.email + " имэйлтэй хэрэглэгч олдсонгүй!", 400);
    }

    const resetToken = user.generatePasswordChangeToken();
    await user.save();

    // await user.save({ validateBeforeSave: false });

    // Имэйл илгээнэ
    const link = `${process.env.HOST}:${process.env.PORT_CLIENT}/reset-password/`;

    const message = "Сайн байна уу<br><br>Та нууц үгээ солих хүсэлт илгээлээ.<br> Нууц үгээ доорхи линк дээр дарж солино уу:<br><br><a target='_blank' href='" + link + "'>Нууц үг солих холбоос</a><br><br>Өдрийг сайхан өнгөрүүлээрэй!";

    const info = await sendEmail({
        email: user.email,
        subject: "Нууц үг өөрчлөх хүсэлт",
        message,
    });

    console.log("Message sent: %s", info.messageId);

    res.status(200).json({
        success: true,
        resetToken,
    });
});

exports.resetPassword = asyncHandler(async (req, res, next) => {
    if (!req.body.resetToken || !req.body.password) {
        throw new MyError("Нууц үг солих токен болон шинэ нууц үгийг дамжуулна уу", 400);
    }
    const encrypted = crypto
        .createHash("sha256")
        .update(req.body.resetToken)
        .digest("hex");

    const user = await User.findOne({
        resetPasswordToken: encrypted,
        resetPasswordExpire: { $gt: Date.now() },
    });
    if (!user) {
        throw new MyError("Нууц үг солих токен хүчингүй байна!", 400);
    }
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const token = user.getJsonWebToken();

    res.status(200).json({
        success: true,
        token,
        user: user,
    });
});

exports.changePassword = asyncHandler(async (req, res, next) => {
    const { email, passold, passnew1, passnew2 } = req.body;
    // Оролтыгоо шалгана
   if (passnew1 !==passnew2) {
        throw new MyError("Шинэ нууц үгийн давталт буруу байна!!!", 400);
    } 
    // Тухайн хэрэглэгчийг user рүү хадгалж авна
    const usercur = await User.findOne({ email }).select("+password");

    const ok = await usercur.checkPassword(passold);
    if (!ok) {
        throw new MyError("Одоогийн нууц үг буруу байна!!!", 401);
    } 
    
    usercur.password = req.body.passnew1;
    await usercur.save();

    const token = usercur.getJsonWebToken();

    res.status(200).json({
        success: true,
        token,
        user: usercur,
    });
});
