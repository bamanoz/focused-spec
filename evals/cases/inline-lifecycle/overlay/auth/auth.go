package auth

func Authenticate(blocked bool, credentialsValid bool) bool {
	return !blocked && credentialsValid
}
