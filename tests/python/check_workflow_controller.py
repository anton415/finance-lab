from scripts.workflow_controller import workflow_controller
from scripts.workflow_controller import desired_pr_status

assert workflow_controller("opened", True, False) == "In progress"
assert workflow_controller("ready_for_review", False, False) == "Review"
assert workflow_controller("closed", False, True) == "Done"
assert workflow_controller("closed", False, False) is None
assert workflow_controller("opened", False, False) == "Review"
assert workflow_controller("ready_for_review", True, False) == "Review"

cases = [
    ("open", True, False, "In progress"),
    ("open", False, False, "Review"),
    ("open", False, True, None),
    ("open", True, True, None),
    ("closed", True, False, None),
    ("closed", False, True, "Done"),
]

for case in cases:
    state, draft, merged, expected = case
    assert desired_pr_status(state, draft, merged) == expected

assert desired_pr_status("open", True, False) == "In progress"