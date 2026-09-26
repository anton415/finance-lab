from scripts.workflow_controller import workflow_controller

assert workflow_controller("opened", True, False) == "In progress"
assert workflow_controller("ready_for_review", False, False) == "Review"
assert workflow_controller("closed", False, True) == "Done"
assert workflow_controller("closed", False, False) is None
assert workflow_controller("opened", False, False) == "Review"