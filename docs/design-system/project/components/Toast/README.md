# Toast

A short confirmation in an ink pill, bottom centre above the dock on phones and bottom left on desktop. One line, optionally one icon, optionally one text action (44px tall) such as Undo. Use `uw-toast--plain` when there is no action. It leaves after four seconds, or stays until dismissed if it carries an action. Use `role="status"`; never use a toast for an error that blocks playback (that is a stage state).
