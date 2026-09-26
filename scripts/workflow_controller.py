# This file is for automation of the workflow controller.
def workflow_controller(event, draft, merged):
    if event == "opened" and draft:
        return "In progress"
    elif event == "ready_for_review":
        return "Review"
    elif event == "closed" and merged:
        return "Done"
    elif event == "opened" and not draft:
        return "Review"
    return None