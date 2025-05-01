const jwt = require("jsonwebtoken");
const asyncHandler = require("./asyncHandle");
const MyError = require("../utils/myError");
const User = require("../models/users");

exports.protect = asyncHandler(async (req, res, next) => {
    // console.log(req.headers);
    let token = null;

    if (req.headers.authorization) {
        token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies) {
        token = req.cookies["user-token"];
    }

    if (!token) {
        throw new MyError(
            "Энэ үйлдлийг хийхийн тулд нэвтрэх хэрэгтэй байна. Та эхлээд логин хийнэ үү. Authorization header-ээр эсвэл Cookie ашиглан токеноо дамжуулна уу.",
            401
        );
    }

    const tokenObj = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = tokenObj.id;
    req.userRole = tokenObj.role;
    req.userCode = tokenObj.code;
    req.userEmail = tokenObj.email;

    next();
});

exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.userRole)) {
            throw new MyError(
                "Таны эрх [" + req.userRole + "] энэ үйлдлийг гүйцэтгэхэд хүрэлцэхгүй!",
                403
            );
        }

        next();
    };
};
