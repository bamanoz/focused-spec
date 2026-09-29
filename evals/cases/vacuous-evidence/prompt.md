Update the Python authentication implementation so that blocked accounts cannot authenticate even with valid credentials. Preserve successful login for active accounts with valid credentials and rejection of invalid credentials. The Go implementation is out of scope.

Keep the existing focused scenario and its evidence selector, update the relevant Python implementation and test as needed, and verify the completed change using the installed focused-spec skill and CLI. Do not change the preconfigured runners, unrelated tests, or installed package files.
