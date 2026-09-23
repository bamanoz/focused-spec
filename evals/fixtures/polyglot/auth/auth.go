package auth

func Authenticate(blocked bool, credentialsValid bool) bool {
	return credentialsValid && !blocked
}
