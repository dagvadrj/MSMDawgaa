const express = require("express");
const { protect, authorize } = require("../middleware/protect");

const {
    register,
    login,
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    forgotPassword,
    resetPassword,
    changePassword,
    logout,
} = require("../controllers/users");

const router = express.Router();

//"users"
router.route("/register").post(register);
router.route("/login").post(login);
router.route("/logout").get(logout);
router.route("/forgot-password").post(forgotPassword);
router.route("/reset-password").post(resetPassword);
router.route("/change-password").post(changePassword);

router.use(protect);

//"users"
router
    .route("/")
    .get(authorize("admin","bagsh"), getUsers)
    .post(authorize("admin"), createUser);

router
    .route("/:id")
    .get(authorize("admin", "bagsh"), getUser)
    .put(authorize("admin"), updateUser)
    .delete(authorize("admin"), deleteUser);

/*router
    .route("/:id/books")
    .get(authorize("admin", "operator", "user"), getUserBooks);

router.route("/:id/comments").get(getUserComments);*/

module.exports = router;